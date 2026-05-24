# Agent B Knowledge Base - Utility Plugins

Scope read: current uncommitted diff for `packages/banner`, `packages/paths`,
`packages/strip`, and paths documentation/tests.

Findings:

- Utility plugin code quality improved overall, especially deterministic paths
  lookup and banner loader source-flow tests.
- One accepted regression finding: after probing `.mjs`, `.cjs`, and `.jsx`
  source files, `@ttsc/paths` still mapped every non-`.mts`/`.cts` source to a
  `.js` output. That would rewrite aliases to files TypeScript-Go did not emit.
- One accepted test-integrity finding: the banner test became weaker when it
  searched for generic `value.default` instead of the full default-selection
  initializer.

Proposals accepted:

- Preserve TypeScript-Go emitted suffixes for `.mjs`, `.cjs`, and JSX preserve
  mode.
- Add command-level `@ttsc/paths` allowJs coverage, not only helper-level
  `lookupSource` coverage.
- Restore the exact initial default-selection assertion while keeping the new
  nested unwrap ordering check.
