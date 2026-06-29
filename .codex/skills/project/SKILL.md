---
name: project
description: What ttsc is, the workspace layout, and the canonical commands.
---

# Project Outline

## Product Contract

`ttsc` is a standalone TypeScript-Go compiler, runtime, plugin host, and LSP host. It ships three CLIs and a plugin protocol:

- `ttsc`: build, check, watch, and source-to-source transform on top of `typescript` (the native TypeScript-Go compiler).
- `ttsx`: run a TypeScript entrypoint after a real type-check (a typed `tsx`/`ts-node`).
- `ttscserver`: LSP host wrapping `tsc --lsp --stdio` and proxying JSON-RPC so ttsc plugin diagnostics, code actions, and `workspace/executeCommand` handlers reach the editor through one stream.
- Plugins: Go source packages that share TypeScript-Go's AST/Checker. Executable `package main` sources build as sidecars; non-`main` transform packages link into a native host. `ttsc` builds plugin source on demand and caches the binary.

The contract is general-purpose. Downstream projects like `typia` and `nestia` are compatibility fixtures, not the product definition.

Graph MCP work has an additional contract in `.codex/skills/project/graph.md`. Read it before changing `packages/graph`, graph benchmark prompts, graph benchmark runners, or the graph benchmark website.

## Layout

- `packages/ttsc`: JS launcher/API plus Go host (`cmd/*`, `driver`, `internal`, `utility`, `shim/`). `driver.PluginSource` is the public seam embedders implement; `NativePluginSource` adapts `capabilities.lsp` sidecars. `internal/lspserver` is the byte-level LSP proxy ttscserver uses.
- `packages/{banner,paths,strip}`: utility transform plugins with package-owned `driver/` logic linked into a generic native host.
- `packages/lint`: `@ttsc/lint` with its own native engine, exposing LSP verbs from `linthost/lsp.go` so ttscserver and `packages/vscode` call them through the language client. Rules may consult the TypeScript-Go Checker directly via `ctx.Checker`; third-party rules ship through the public `rule` package and may use the `rule/astutil` helpers.
- `packages/wasm`: `@ttsc/wasm`, Go `host` helper plus JS boot scaffolding for in-browser ttsc playgrounds. `host.Expose` binds `globalThis[apiName]` with the standard verbs (`build/check/transform/plugin/plugins/version`) plus fountain verbs (`snapshot/getDiagnostics/getNodeAtPosition/...`) over a snapshot handle table.
- `packages/playground`: `@ttsc/playground`, reusable Web Worker + React shell built on `@ttsc/wasm`. Exports `createWorkerCompiler` (worker-side `ICompilerService` factory), `PlaygroundShell` (Tailwind 4 React component), runtime npm dependency installer, typia source/runtime pack helpers, and Monaco editor wrappers. Consumed by `website/` and `typia/website/`.
- `packages/factory`: `@ttsc/factory`, a hand-written, zero-dependency TypeScript AST factory and width-aware printer (no `typescript` import) for source-code generation that survives the tsgo migration. Standalone published library; nothing else in the workspace depends on it yet.
- `packages/unplugin`: bundler adapters.
- `packages/vscode`: VS Code extension that wires `vscode-languageclient` to ttscserver, exposes the built-in lint/format command bridge, and lets other plugin command ids execute through the language client with editor-applied `WorkspaceEdit`s.
- `packages/ttsc-*`: per-platform packages (native helper + bundled Go SDK). Each ships both the `ttsc` helper and the `ttscserver` binary.
- `tests/projects`: project-shaped fixtures copied into temp dirs by `TestProject.copyProject`.
- `tests/test-*`: feature-test packages (run via `pnpm test:features`).
- `tests/utils`: shared helpers (`@ttsc/testing`).
- `tests/<plugin-name>`: workspace packages that need to be `require.resolve`-able from a fixture's `node_modules` (e.g. `tests/lint-contributor-demo`). Built by `scripts/build-current.cjs` before tests run.
- `website`: Nextra-based docs site (`src/content/docs/**/*.mdx`) that is the canonical home for guides, shipped to https://ttsc.dev.
- `config`, `scripts`: shared tsconfig and workspace scripts.

## Commands

```bash
pnpm install
pnpm format
pnpm build
pnpm test:go
pnpm test
```
