# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- fix(client): eliminate macOS ghosting/phantom of toasts on Apple Silicon (transparent Electron window + backdrop-filter). Added compositing hints (`translateZ(0)`, `backface-visibility: hidden`, `will-change`, `contain: paint`) and a short fade-out before removal to force clean repaints. Docs updated in README Troubleshooting.

