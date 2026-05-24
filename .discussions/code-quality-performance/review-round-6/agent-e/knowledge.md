# Agent E Knowledge

Scope: test integrity across modified and new tests.

Findings:

- No tests were deleted, skipped, or narrowed.
- New Go and TypeScript tests follow one-case-per-file conventions.
- The paths allowJs e2e used a narrow `@ts-ignore`, but that still suppressed
  any diagnostic on the line.

Proposal: replace the suppression with a local ambient module declaration while
keeping emitted-output assertions.
