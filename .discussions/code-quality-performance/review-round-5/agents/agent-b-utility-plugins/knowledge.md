# Agent B Knowledge Base - Utility Plugins

Review found quality improvements in `@ttsc/paths` and banner tests. Accepted
minor hardening items:

- Add index-style JavaScript lookup coverage for `allowJs`.
- Correct the allowJs e2e doc comment to match the Bundler fixture.
- Assert the emitted target files exist before checking rewritten suffixes.

No weakened/deleted tests, consumer hardcoding, or over-optimization remained
after those fixes.
