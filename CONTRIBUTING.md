# Contributing to Neon City Drive

Thanks for your interest in improving Neon City Drive! This is a single-file
Three.js project, so the workflow is intentionally lightweight.

## Project structure

Everything lives in `neon-city-drive/index.html` — Three.js, all game logic,
canvas-generated textures, and Web Audio sound are inlined into that one file.
There is no build step, bundler, or package.json.

## Getting set up

1. Fork and clone the repo
2. Open `neon-city-drive/index.html` directly in a browser, or serve it locally:
   ```bash
   python3 -m http.server 8000
   ```
3. Make your changes directly in `index.html`

## Making changes

- Keep the game **fully offline** — don't add external CDN scripts, fonts, or
  network calls. All assets (textures, audio) should stay procedurally
  generated or inlined.
- Test in-browser before opening a PR: drive around, enter/exit vehicles,
  check both day and night, and verify mobile touch controls still work if
  you touched input handling.
- Match the existing code style (compact, minimal comments, functional
  helpers) rather than introducing a new pattern for one change.
- Keep commits focused — one logical change per commit/PR is easier to review
  than a large mixed diff.

## Reporting bugs / requesting features

Please use the issue templates when opening a new issue — they help us
triage faster.

## Pull requests

1. Create a branch off `main`
2. Make your change and verify it works in the browser
3. Open a PR using the pull request template
4. Describe what you tested (desktop browser, mobile, both day/night, etc.)

## Code of Conduct

By participating in this project, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
