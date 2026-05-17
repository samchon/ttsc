# `@ttsc/vscode` — VSCode extension

Audience: workspace user who wants ttsc's lint/format diagnostics and
commands inside VSCode, and contributor working on the extension itself.

## What it provides

- Spawns [`ttscserver`](./15-ttscserver.md) from the workspace's installed
  `ttsc` package (or a user-supplied absolute path).
- Routes all standard LSP traffic — diagnostics, hovers, completions,
  definitions, code actions — between VSCode and the embedded tsgo LSP
  server, with ttsc plugin contributions merged in.
- Adds command palette entries:
  - `ttsc: Apply lint fixes to current file`
  - `ttsc: Format current document`
  - `ttsc: Restart language server`

## Local install for testing

From the repository root:

```bash
pnpm install
pnpm -F @ttsc/vscode build
```

Launch VSCode with the extension loaded as an extension under
development:

```bash
code --extensionDevelopmentPath=packages/vscode <your-project>
```

The extension activates on TypeScript / TSX / JS / JSX files. Look at
the Output channel named `ttsc` for the language server log.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `ttsc.serverPath` | `""` | Absolute path to the ttscserver binary. Empty = resolve the binary shipped with the workspace's ttsc dependency. |
| `ttsc.trace.server` | `"off"` | LSP message tracing; set to `"messages"` or `"verbose"` for debugging the wire. |

## How code actions and commands flow

1. VSCode requests `textDocument/codeAction` for a range.
2. ttscserver forwards the request to tsgo; in parallel it asks the
   active `PluginSource` for ttsc-owned actions for the same range.
3. The merged response reaches VSCode and the actions appear in the
   editor's lightbulb menu.
4. When the user runs a ttsc-owned command (e.g.
   `ttsc.lint.fixAll`), ttscserver intercepts the
   `workspace/executeCommand` request and returns a `WorkspaceEdit` in
   the result body.
5. The extension applies the edit via `workspace.applyEdit`.

## Architecture pointer

See [ttscserver Guide](./15-ttscserver.md) for the full architecture
diagram and the plugin contribution surface. The extension itself is
intentionally thin — anything beyond client-side glue lives in
`packages/ttsc/driver`.
