# @ttsc/vscode

VSCode extension that runs the `ttscserver` Language Server for TypeScript-Go
projects. It surfaces ttsc plugin (lint/format) diagnostics alongside the
tsgo type-check diagnostics in the same publishDiagnostics stream and
exposes ttsc-owned code actions and commands.

## What it does

- Spawns `ttscserver` from the workspace's installed `ttsc` package (or a
  user-supplied absolute path).
- Receives merged diagnostics, hovers, completions, definitions from the
  embedded tsgo LSP server.
- Adds the ttsc-owned commands `ttsc.lint.fixAll`, `ttsc.format.document`,
  and `ttsc.server.restart` to the command palette.

## Local install (testing)

```bash
# from the repo root
pnpm install
pnpm -F @ttsc/vscode build
```

Then in VSCode:

```bash
code --extensionDevelopmentPath=packages/vscode <your-project>
```

The extension activates on any TypeScript / TSX / JS / JSX file inside the
project. The Output channel "ttsc" shows the language server log.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `ttsc.serverPath` | `""` | Absolute path to the `ttscserver` binary. Empty means resolve from the workspace `ttsc` install. |
| `ttsc.trace.server` | `"off"` | LSP message tracing — set to `"messages"` or `"verbose"` for debugging. |
