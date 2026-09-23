---
name: project
description: Maps ttsc's product boundaries and package ownership, and holds the @ttsc/graph contract and the @ttsc/evidence implementation invariants. Use when a task crosses package boundaries or needs the package that owns a behavior, and before changing packages/graph, graph benchmark prompts, or @ttsc/evidence rule semantics, tag grammar, configuration surface, or diagnostics.
---

# Project Outline

## Product Contract

- The contract is general-purpose. Downstream projects such as `typia` and `nestia` are compatibility fixtures, not the product definition.
- `ttsc` builds, checks, watches, and transforms source on top of `typescript`, the native TypeScript-Go compiler. `ttsx` runs a TypeScript entrypoint after a real type-check.
- `ttscserver` wraps `tsc --lsp --stdio` and proxies JSON-RPC, so plugin diagnostics, code actions, and `workspace/executeCommand` handlers reach the editor through one stream.
- Plugins are Go source packages that share TypeScript-Go's AST and Checker. An executable `package main` source builds as a sidecar, and a non-`main` transform package links into a native host. `ttsc` builds plugin source on demand and caches the binary.

## Layout

Each package's README describes what it does and how to use it. This table records which path owns a behavior, plus the facts a change needs that the README does not state.

| Path | Owns | Beyond its README |
| --- | --- | --- |
| `packages/ttsc` | The JS launcher and API plus the Go host (`cmd/*`, `driver`, `internal`, `utility`, `shim/`) | `driver.PluginSource` is the seam embedders implement, `NativePluginSource` adapts `capabilities.lsp` sidecars, and `internal/lspserver` is the byte-level LSP proxy `ttscserver` uses. The shim follows the typescript-go-sync skill. |
| `packages/{banner,paths,strip}` | Utility transform plugins | Each package's logic lives in its own `driver/` and links into a generic native host. |
| `packages/lint` | `@ttsc/lint` and its native engine | LSP verbs live in `linthost/lsp.go`, which `ttscserver` and `packages/vscode` call through the language client. |
| `packages/evidence` | `@ttsc/evidence`, a lint contributor | It ships Go source under `native/` instead of a module, because ttsc copies a contributor's source directory into `@ttsc/lint`'s Go module and rejects a `go.mod` inside it; the `go.mod` one level up exists for local tooling. Its implementation invariants are [evidence/SKILL.md](evidence/SKILL.md). |
| `packages/graph` | `@ttsc/graph`, the MCP server | Its contract is [graph.md](graph.md). |
| `packages/wasm` | `@ttsc/wasm`, the in-browser host |  |
| `packages/playground` | `@ttsc/playground`, the playground shell | `website/` and `typia/website/` consume it. |
| `packages/factory` | `@ttsc/factory`, the AST factory and printer | Nothing else in the workspace depends on it. |
| `packages/unplugin` | Bundler adapters |  |
| `packages/metro` | The Metro adapter built on `@ttsc/unplugin` |  |
| `packages/vscode` | The VS Code extension | It wires `vscode-languageclient` to `ttscserver`, bridges the built-in lint and format commands, and executes other plugin command ids with editor-applied `WorkspaceEdit`s. |
| `packages/ttsc-*` | Per-platform packages |  |
| `tests/test-*` | Feature-test packages, run by `pnpm test:features` |  |
| `tests/projects` | Project-shaped fixtures that `TestProject.copyProject` copies into temporary directories |  |
| `tests/utils` | Shared test helpers (`@ttsc/testing`) |  |
| `tests/<plugin-name>` | Workspace packages a fixture must `require.resolve` from its `node_modules`, such as `tests/lint-contributor-demo` | `scripts/build-current.cjs` builds them before tests run. |
| `benchmarks/*` | One private package per benchmark, each with its own README | Operated through the benchmark skill. |
| `website` | The Nextra docs site under `src/content/docs/**/*.mdx`, shipped to https://ttsc.dev | The canonical home for guides. |
| `config`, `scripts` | Shared tsconfig and workspace scripts |  |

## Graph MCP

The `@ttsc/graph` contract is [graph.md](graph.md). Read it before changing `packages/graph`, its MCP instruction or schema, graph benchmark prompts, or the graph benchmark website.

## Evidence Graph

The `@ttsc/evidence` implementation invariants are [evidence/SKILL.md](evidence/SKILL.md). Read them before changing rule semantics, the tag grammar, the configuration surface, or a diagnostic message.
