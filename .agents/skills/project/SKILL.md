---
name: project
description: Maps which ttsc package owns a behavior, with the product, @ttsc/graph, and @ttsc/evidence contracts. Use when a task crosses packages, and before changing packages/graph, graph benchmark prompts, or @ttsc/evidence rule semantics, tags, configuration, or diagnostics.
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

Before changing `packages/graph`, its MCP instruction or schema, or graph benchmark prompts, read [graph.md](graph.md). Before changing `@ttsc/evidence` semantics, read [evidence.md](evidence.md).
