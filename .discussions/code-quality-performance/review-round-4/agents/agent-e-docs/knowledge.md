# Agent E Knowledge Base - Documentation

Scope read: current docs diff plus nearby docs for cache behavior, paths, lint
rules, and driver API.

Findings:

- Docs are clearer for paths `rewriter` naming, allowJs lookup, and wasm MemFS
  copy semantics.
- Remaining accepted gaps: `--cache-dir` docs did not consistently say relative
  paths resolve from `--cwd`, explicit caches need `ttsc clean --cache-dir`, the
  lint catalog omitted `no-loss-of-precision`, and the LSP driver row omitted
  paired constructors/parsers.

Proposals accepted:

- Update `compile.mdx`, `execute.mdx`, and architecture docs for cache root,
  ttsx runtime subtree, plugin subtree, and explicit-cache clean command.
- Add `no-loss-of-precision` to the lint rules catalog.
- Split/list LSP framing and envelope parsing helpers accurately.
- Rephrase paths plugin docs so extension suffix behavior is not confused with
  rewriting arbitrary non-alias specifiers.
- Reword linkname helper comments to call names test-local adapters.
