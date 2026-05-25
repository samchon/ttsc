# `@ttsc/vscode`

![banner of @ttsc/vscode](https://ttsc.dev/og.jpg)

MIT licensed · [npm](https://www.npmjs.com/package/@ttsc/vscode) · [docs](https://ttsc.dev/docs) · [Discord](https://discord.gg/E94XhzrUCZ)

VS Code extension for [`ttsc`](https://ttsc.dev) projects.

It starts the `ttscserver` language-server launcher from your project's own
`ttsc` dependency, so VS Code uses the same TypeScript-Go version your project
pins.

## Requirements

- **VS Code** 1.94 or later
- **Node.js** 18 or later
- **`ttsc` installed in your project** — the extension uses the language server
  that ships with your project's `ttsc` package

```bash
npm install -D ttsc @typescript/native-preview
```

## Install

The extension is not on the VS Code Marketplace yet. For now it ships as an npm package with a one-shot installer:

```bash
npm install -D @ttsc/vscode
npx ttsc-vscode
```

`npx ttsc-vscode` calls `code --install-extension` with the `.vsix` bundled in the npm tarball — VS Code picks it up immediately, no restart needed.

If the `code` CLI isn't on your `PATH`, open VS Code first, run **Shell Command: Install 'code' command in PATH** from the command palette, then re-run `npx ttsc-vscode`. (As a manual fallback, VS Code → Extensions → "…" menu → **Install from VSIX** also works on the file `npx ttsc-vscode` would have used — it lives under `node_modules/@ttsc/vscode/dist/`.)

To uninstall:

```bash
npx ttsc-vscode uninstall
```

Marketplace release is tracked for v1; once it lands, the `npx` step goes away.

## What it adds

The extension activates on TypeScript, JavaScript, TSX, and JSX files, then
starts a server only when it can resolve a project-local `ttscserver`.

- **Project-local language server.** The extension resolves `ttscserver` from
  the active file's package/workspace, then starts the project-selected
  `tsgo --lsp --stdio` process behind it.
- **TypeScript-Go diagnostics and editor features.** Hover, navigation,
  completions, and TypeScript-Go diagnostics come from the upstream `tsgo` LSP
  process.
- **ttsc plugin diagnostics and actions.** LSP-capable plugins are discovered
  from the same project config and merged into the editor stream. `@ttsc/lint`
  currently contributes lint diagnostics, fix-all actions, and document format
  edits. Plugin diagnostics, code actions, and command computation use the
  saved project state today; commands return VS Code `WorkspaceEdit`s and the
  editor applies them only while the touched documents are still clean.
- **Monorepo-aware server roots.** Multi-root workspaces start server contexts
  from the active file and workspace folders, resolved from the nearest
  `tsconfig*.json` / `jsconfig*.json`. Add packages as VS Code workspace
  folders when you want each package to keep its own active server context.
- **Command palette entries:** `ttsc: Restart language server`,
  `ttsc: Fix all lint issues`, and `ttsc: Format document`. The lint and
  format commands require an LSP-capable plugin that owns those command ids,
  such as `@ttsc/lint`. The VS Code extension registers wrapper commands for
  those built-in lint/format flows; other plugin command ids are advertised
  through the language client and their returned `changes`-map `WorkspaceEdit`s
  are applied with the same clean-document guard.

The extension's identifier inside VS Code is `samchon.ttsc`.

## Settings

Open VS Code's settings (`Ctrl+,` / `Cmd+,`) and search for `ttsc`, or edit `settings.json` directly:

| Setting             | Default | Effect                                                                                                                                                                                                                                 |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttsc.serverPath`   | `""`    | Absolute path to a `ttscserver` launcher or native binary. Empty uses the project's `ttsc` launcher, which builds `TTSC_LSP_PLUGINS_JSON` for plugin diagnostics/actions. Direct native paths need that manifest supplied out of band. |
| `ttsc.trace.server` | `"off"` | Set to `"messages"` or `"verbose"` to log LSP traffic. The trace goes to **View → Output → ttsc (trace)**; server logs stay under **ttsc**. Useful when diagnostics don't show up.                                                     |

## Troubleshooting

If TypeScript-Go or ttsc plugin diagnostics don't appear after install:

1. **Check the project has `ttsc`:** `npx ttsc --version`. If this errors, install `ttsc @typescript/native-preview` in the project first.
2. **Check the same config in the CLI:** run `npx ttsc --noEmit -p <selected tsconfig>` from the project root and confirm the plugin diagnostics appear there.
3. **Read the server log:** open **View → Output**, pick **ttsc** from the dropdown.
4. **Restart the server:** command palette → `ttsc: Restart language server`.
5. **Verbose tracing:** set `ttsc.trace.server` to `"verbose"`, then read **View → Output → ttsc (trace)**.

If `npx ttsc-vscode` errors with `\`code\` CLI not found on PATH`: open VS Code → command palette → **Shell Command: Install 'code' command in PATH**, then retry the install.
