---
name: project
description: Maps which ttsc package owns a behavior, with the rules for changing @ttsc/graph and @ttsc/evidence. Use when a task crosses packages or needs the owner of a behavior, and before changing packages/graph or @ttsc/evidence semantics.
---

# Project

ttsc is general-purpose; typia and nestia are compatibility fixtures, not the product definition. `ttsx` type-checks before running, and `ttsc/register` checks each TypeScript module it loads. `ttscserver` proxies `tsc --lsp --stdio` so plugin diagnostics, code actions, and commands share one stream. A `package main` plugin builds as a sidecar; other plugin packages link into a native host. ttsc builds plugins on demand and caches the binary.

| Path | Owns, and what its README does not say |
| --- | --- |
| `packages/ttsc` | Launcher, API, and Go host. `driver.PluginSource` is the embedder seam, `NativePluginSource` adapts `capabilities.lsp` sidecars, `internal/lspserver` is the proxy behind `ttscserver`. |
| `packages/{banner,paths,strip}` | Transform plugins, each with logic in its own `driver/` linked into a generic host. |
| `packages/lint` | `@ttsc/lint`; LSP verbs live in `linthost/lsp.go`. |
| `packages/evidence` | `@ttsc/evidence`, a lint contributor. Its Go source sits in `native/` without a `go.mod` because ttsc rejects one inside a contributor directory. |
| `packages/graph`, `packages/graph-*` | `@ttsc/graph` and its per-platform `ttscgraph` binaries, resolved from its own installation. |
| `packages/ttsc-*` | Per-platform `ttsc` helper, `ttscserver`, and Go SDK, built by `packages/ttsc/build/platform-package.cjs`. |
| `packages/{wasm,playground,factory,unplugin,metro,vscode}` | Browser host, playground shell, AST factory (only `tests/test-factory` uses it), bundler adapters, VS Code extension. |
| `tests/` | Unit suites, the single `tests/test-e2e`, shared `tests/utils`, and workspace plugin fixtures that `pnpm build` builds. |
| `benchmarks/*`, `website` | One package per benchmark; the docs site for https://ttsc.dev. |

## Graph And Evidence

- `@ttsc/graph`: [its README](../../../packages/graph/README.md) explains the design. Keep the MCP instruction's first 512 characters saying what the tool is, when to use it, and why its facts hold, and measure every graph change through the benchmark skill.
- `@ttsc/evidence`: the [Evidence Tags](../../../website/src/content/docs/evidence/tags.mdx) and [Configuration](../../../website/src/content/docs/evidence/claims.mdx) guides own its semantics, and the behavior-named tests in `packages/evidence/native` fix its invariants; a semantic change updates both. Never make a graph pass by excluding, retargeting, or deleting an author's citation, and never add a rule that judges whether a reason is sincere.
