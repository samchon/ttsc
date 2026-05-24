# Agent E Integrity Notes

Scope: current working-tree diff for integration, docs drift, generated
artifacts, and AGENTS.md test conventions. No source edits.

## Findings

1. Accept: LSP header cap needed chunked reading before line allocation.
2. Accept: `ttsx` cleanup needed to cover ESM rewrite and package marker errors.
3. Accept: `execute.mdx` needed updated runtime-cache language.
4. Accept: the `@ttsc/paths` walkthrough and source comment needed to remove
   the old extensionless `sourceFiles` alias model.
5. Accept: new banner/paths regression assertions should be split into focused
   one-case-per-file Go tests.
6. Defer/remove from this changeset: unrelated untracked blog/article files are
   not part of the compiler quality/performance work.
