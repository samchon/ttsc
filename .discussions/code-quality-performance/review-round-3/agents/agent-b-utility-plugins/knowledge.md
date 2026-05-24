# Agent B Knowledge Base - Utility Plugins

Scope read: changed `packages/banner`, `packages/paths`, `packages/strip`
utility-plugin tests/docs, especially `packages/paths/driver/paths.go` and
`website/src/content/docs/development/walkthroughs/paths.mdx`.

Findings:

- Banner loader changes improve correctness around nested default exports and
  Node loader timeout behavior. No hardcoded fixture-only behavior found.
- The softened banner source-generation test is better than the earlier exact
  generated-line assertion because it checks control-flow ordering instead of
  locking incidental whitespace.
- `@ttsc/paths` deterministic source lookup is sound, but the current extension
  probe list only includes TypeScript extensions. Because
  `stripKnownSourceExtension` already recognizes `.js`, `.jsx`, `.mjs`, and
  `.cjs`, removing extensionless map aliases regressed extensionless path
  targets in `allowJs` projects.
- Documentation still used stale internal names (`pathsRewriter`,
  `pathsPattern`, `newPathsRewriter`) after the code settled on `rewriter`,
  `pathPattern`, and `newRewriter`.

Proposals:

- Extend deterministic `lookupSource` probing to JavaScript source extensions
  after TypeScript extensions and add a focused Go helper test.
- Strengthen the ambiguous-stem helper test so `.ts` priority is also proven
  against `.js`, not only `.tsx`.
- Update paths walkthrough docs to current internal names and list the complete
  extension probe order.
