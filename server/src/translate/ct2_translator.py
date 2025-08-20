#!/usr/bin/env python3
import sys
import json
import argparse

"""
Optional CTranslate2-based translator stub.

Usage:
  python3 ct2_translator.py --from de --to en < input.txt > output.json

Environment variables (optional):
  CT2_MODEL_DE_EN: path to CTranslate2 model for de->en
  CT2_MODEL_EN_DE: path to CTranslate2 model for en->de

If ctranslate2/sentencepiece are not installed or models are missing, this
script will gracefully return the input text unmodified.
"""

def load_input_text():
    data = sys.stdin.read()
    return data or ""

def safe_error(translated, reason):
    print(json.dumps({"translated": translated, "meta": {"provider": "ct2", "reason": reason}}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="src", required=True)
    parser.add_argument("--to", dest="tgt", required=True)
    args = parser.parse_args()

    text = load_input_text()
    # best effort: try import
    import os
    import json as _json
    # Soft-import: allow HF-only mode without CT2/SPM
    try:
        import ctranslate2 as _ct2  # type: ignore
    except Exception:  # pragma: no cover
        _ct2 = None
    try:
        import sentencepiece as spm  # type: ignore
    except Exception:  # pragma: no cover
        spm = None

    src = args.src.lower()
    tgt = args.tgt.lower()
    force_hf = os.environ.get("TRANSLATOR_FORCE_HF", "false").lower() == "true"

    # (translator will be initialized later if CT2 path is selected)

    # Prefer HuggingFace tokenizer when available (best match with ct2-transformers models)
    hf_tok = None
    hf_dir = None
    try:
        from transformers import AutoTokenizer  # type: ignore
        # Try local HF model folder next to CT2 model
        repo_guess = "models/hf/opus-mt-de-en" if src == "de" and tgt == "en" else (
            "models/hf/opus-mt-en-de" if src == "en" and tgt == "de" else None
        )
        if repo_guess and os.path.isdir(repo_guess):
            hf_dir = repo_guess
            hf_tok = AutoTokenizer.from_pretrained(hf_dir, local_files_only=True)
    except Exception:
        hf_tok = None

    # (SentencePiece tokenizers will be initialized later if CT2 path is used)

    # (HF force handling is applied after helper definitions below)

    # Otherwise, prepare CT2 path (optional when installed/configured)
    model_env = "CT2_MODEL_DE_EN" if src == "de" and tgt == "en" else (
        "CT2_MODEL_EN_DE" if src == "en" and tgt == "de" else None
    )
    if model_env is None:
        return safe_error(text, "unsupported_direction")

    model_path = os.environ.get(model_env)
    if not model_path:
        # If HF local model is available, use it as fallback
        if hf_dir:
            # Will be executed after helpers are defined
            pass
        else:
            return safe_error(text, "model_path_missing")

    # Initialize CT2 translator if available
    translator = None
    if _ct2 is not None and model_path:
        try:
            translator = _ct2.Translator(model_path)
        except Exception:
            return safe_error(text, "model_load_failed")

    # Initialize SentencePiece models if HF tokenizer not available
    sp_src = spm.SentencePieceProcessor() if spm is not None else None
    sp_tgt = spm.SentencePieceProcessor() if spm is not None else None
    sp_mode = None
    if hf_tok is None:
        sp_src_path = os.path.join(model_path, "source.spm")
        sp_tgt_path = os.path.join(model_path, "target.spm")
        shared_spm_path = os.path.join(model_path, "spm.model")
        try:
            if sp_src is not None and sp_tgt is not None:
                if os.path.exists(sp_src_path) and os.path.exists(sp_tgt_path):
                    sp_src.Load(sp_src_path)
                    sp_tgt.Load(sp_tgt_path)
                    sp_mode = "separate"
                elif os.path.exists(shared_spm_path):
                    sp_src.Load(shared_spm_path)
                    sp_tgt.Load(shared_spm_path)
                    sp_mode = "shared"
                else:
                    return safe_error(text, "spm_missing")
            else:
                if translator is None:
                    return safe_error(text, "deps_missing")
        except Exception:
            return safe_error(text, "spm_load_failed")

    # Try to detect language tags in vocab (for OPUS-MT families)
    def detect_lang_tag(tag):
        try:
            vocab_path = os.path.join(model_path, "shared_vocabulary.json")
            if os.path.exists(vocab_path):
                with open(vocab_path, "r", encoding="utf-8") as f:
                    vocab = _json.load(f)
                return tag if tag in vocab else None
        except Exception:
            pass
        return None

    tgt_tag = ">>en<<" if src == "de" and tgt == "en" else (">>de<<" if src == "en" and tgt == "de" else None)
    if hf_tok is not None:
        try:
            vocab = hf_tok.get_vocab()
            tgt_tag = tgt_tag if (tgt_tag and tgt_tag in vocab) else None
        except Exception:
            tgt_tag = None
    else:
        tgt_tag = detect_lang_tag(tgt_tag) if tgt_tag else None

    def translate_block(block):
        # basic, line-wise translation to keep formatting
        lines = block.split("\n")
        out_lines = []
        for ln in lines:
            if ln.strip() == "":
                out_lines.append(ln)
                continue
            if hf_tok is not None:
                tokens = hf_tok.tokenize(ln)
            else:
                tokens = sp_src.EncodeAsPieces(ln) if sp_src is not None else []
            # Decoding options to reduce repetitions and ensure termination
            options = dict(
                beam_size=4,
                length_penalty=1.0,
                max_decoding_length=min(256, max(32, int(len(tokens) * 3 + 20))),
                repetition_penalty=1.1,
                no_repeat_ngram_size=3,
                disable_unk=True,
                end_token=["</s>"],
                use_vmap=True
            )

            if tgt_tag:
                res = translator.translate_batch(
                    [tokens], target_prefix=[[tgt_tag]], **options
                )
            else:
                res = translator.translate_batch([tokens], **options)
            out_toks = res[0].hypotheses[0]
            if hf_tok is not None:
                out_lines.append(hf_tok.convert_tokens_to_string(out_toks))
            else:
                out_lines.append(sp_tgt.DecodePieces(out_toks) if sp_tgt is not None else ln)
        return "\n".join(out_lines)

    def looks_degenerate(s: str) -> bool:
        import re
        toks = re.findall(r"\w+", s)
        if len(toks) < 8:
            return False
        uniq = len(set(w.lower() for w in toks))
        return (uniq / max(1, len(toks))) < 0.35

    # Optional HuggingFace fallback for quality
    def hf_translate_block(block: str) -> str:
        try:
            from transformers import MarianMTModel, MarianTokenizer  # type: ignore
            if not hf_dir:
                return block
            tok = MarianTokenizer.from_pretrained(hf_dir, local_files_only=True)
            mdl = MarianMTModel.from_pretrained(hf_dir, local_files_only=True)
            import torch as _torch
            mdl.to("cpu")

            def _gen_args(text_len_chars: int):
                # cap length relative to input size
                max_new = max(16, min(64, int(text_len_chars * 0.6 + 16)))
                return dict(
                    num_beams=5,
                    early_stopping=True,
                    max_new_tokens=max_new,
                    length_penalty=0.9,
                    no_repeat_ngram_size=3,
                    repetition_penalty=1.15,
                )

            outs = []
            for ln in block.split("\n"):
                if ln.strip() == "":
                    outs.append(ln)
                    continue
                enc = tok([ln], return_tensors="pt", padding=False)
                args = _gen_args(len(ln))
                gen = mdl.generate(**enc, **args)
                text = tok.decode(gen[0], skip_special_tokens=True)
                # If still degenerate, retry more strict
                if looks_degenerate(text):
                    gen = mdl.generate(
                        **enc,
                        num_beams=6,
                        early_stopping=True,
                        max_new_tokens=args["max_new_tokens"],
                        length_penalty=0.8,
                        no_repeat_ngram_size=4,
                        repetition_penalty=1.3,
                    )
                    text = tok.decode(gen[0], skip_special_tokens=True)
                outs.append(text)
            return "\n".join(outs)
        except Exception:
            return block

    # If HF is forced and local model dir exists, translate immediately
    if force_hf and hf_dir:
        translated = hf_translate_block(text)
        print(json.dumps({"translated": translated, "meta": {"provider": "hf", "direction": f"{src}->{tgt}", "spm": None}}))
        return

    try:
        if translator is not None:
            translated = translate_block(text)
            if hf_dir and looks_degenerate(translated):
                translated = hf_translate_block(text)
                prov = "ct2+hf"
            else:
                prov = "ct2"
        elif hf_dir:
            translated = hf_translate_block(text)
            prov = "hf"
        else:
            return safe_error(text, "deps_missing")
    except Exception:
        if hf_dir:
            translated = hf_translate_block(text)
            prov = "hf"
        else:
            return safe_error(text, "translate_failed")

    print(json.dumps({"translated": translated, "meta": {"provider": prov, "direction": f"{src}->{tgt}", "spm": sp_mode}}))

if __name__ == "__main__":
    main()
