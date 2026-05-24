# Agent E Knowledge Base - Documentation

Scope read: changed website docs, `AGENTS.md`, README-adjacent public docs, and
driver/API references.

Findings:

- Documentation quality improved overall because runtime temporary output,
  source-plugin caching, and paths lookup behavior are now visible to users.
- Stale paths walkthrough names remained after code changes: `pathsRewriter`,
  `pathsPattern`, and `newPathsRewriter` no longer match source.
- Public driver docs mention LSP server entry points but omitted the newly
  exported byte-framing helpers and size caps.
- `AGENTS.md` command list omitted `pnpm test:go` even though root `pnpm test`
  now runs it and maintainers need the narrower validation command.
- WASM docs did not state the MemFS byte-copy contract.

Proposals:

- Update paths walkthrough names and extension probing docs.
- Add `pnpm test:go` to `AGENTS.md`.
- Add `FrameReader`, `Envelope`, `WriteFrame`, `MaxFrameBytes`,
  `MaxHeaderBytes`, and `ErrFrameTooLarge` to the driver API reference.
- Add MemFS byte-copy rules to the wasm guide.
- Sweep other docs for stale `pathsRewriter` references.
