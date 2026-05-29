# `@ttsc/vscode`

![banner of @ttsc/vscode](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/vscode.svg)](https://www.npmjs.com/package/@ttsc/vscode) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/vscode.svg)](https://www.npmjs.com/package/@ttsc/vscode) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

VS Code extension for [`ttsc`](https://ttsc.dev) projects.

It starts the `ttscserver` language-server launcher from your project's own `ttsc` dependency, so VS Code uses the same TypeScript-Go version your project pins.

## Setup

### Requirements

- **VS Code** 1.94 or later
- **Node.js** 18 or later
- **`ttsc`, `@ttsc/lint`, and `@typescript/native-preview` installed in your project** — the extension runs the language server from your project's `ttsc`; `@typescript/native-preview` is the TypeScript-Go engine `ttsc` runs on (a separate package — `ttsc` does not bundle it), and `@ttsc/lint` supplies the lint diagnostics and format rules.

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
```

### Install

The extension is not on the VS Code Marketplace yet. For now it ships as an npm package with a one-shot installer:

```bash
npm install -D @ttsc/vscode
npx @ttsc/vscode
```

`npx @ttsc/vscode` calls `code --install-extension` with the `.vsix` bundled in the npm tarball — VS Code picks it up immediately, no restart needed.

If the `code` CLI isn't on your `PATH`, open VS Code first, run **Shell Command: Install 'code' command in PATH** from the command palette, then re-run `npx @ttsc/vscode`. (As a manual fallback, VS Code → Extensions → "…" menu → **Install from VSIX** also works on the file `npx @ttsc/vscode` would have used — it lives under `node_modules/@ttsc/vscode/dist/`.)

To uninstall:

```bash
npx @ttsc/vscode uninstall
npm uninstall @ttsc/vscode
```

Marketplace release is tracked for v1; once it lands, the `npx` step goes away.

### Settings

Open VS Code's settings (`Ctrl+,` / `Cmd+,`) and search for `ttsc`, or edit `settings.json` directly:

| Setting | Default | Effect |
| --- | --- | --- |
| `ttsc.serverPath` | `""` | Absolute path to a `ttscserver` launcher or native binary. Empty uses the project's `ttsc` launcher, which builds `TTSC_LSP_PLUGINS_JSON` for plugin diagnostics/actions. Direct native paths need that manifest supplied out of band. |
| `ttsc.trace.server` | `"off"` | Set to `"messages"` or `"verbose"` to log LSP traffic. The trace goes to **View → Output → ttsc (trace)**; server logs stay under **ttsc**. Useful when diagnostics don't show up. |

To format on save, make `samchon.ttsc` the default formatter for the languages you want and enable `editor.formatOnSave`:

```jsonc
"[typescript][typescriptreact]": {
  "editor.defaultFormatter": "samchon.ttsc",
  "editor.formatOnSave": true
}
```

ttsc formats the in-memory buffer, so it works on unsaved edits. Lint **fixes** are not applied on save by default — they can change code meaning — so run `ttsc: Fix all lint issues` manually, or opt in with `"editor.codeActionsOnSave": { "source.fixAll.ttsc": "explicit" }`.

## What it adds

The extension activates on TypeScript, JavaScript, TSX, and JSX files, then starts a server only when it can resolve a project-local `ttscserver`.

- **Project-local language server.** The extension resolves `ttscserver` from the active file's package/workspace, then starts the project-selected `tsgo --lsp --stdio` process behind it.
- **TypeScript-Go diagnostics and editor features.** Hover, navigation, completions, and TypeScript-Go diagnostics come from the upstream `tsgo` LSP process.
- **ttsc plugin diagnostics and actions.** Project plugins are merged into the editor stream; `@ttsc/lint` contributes lint diagnostics plus fix-all and format actions. These read your **saved** file — so save before relying on a lint fix — except format-on-save, which works on the live buffer (see [Settings](#settings)).
- **Format on save.** With `editor.formatOnSave` and `samchon.ttsc` as the default formatter, the extension formats your unsaved buffer using `@ttsc/lint`'s format rules — no need to save first. Lint fixes stay off-save by default (they can change code meaning). See [Settings](#settings) to enable it.
- **Monorepo-aware server roots.** Multi-root workspaces start server contexts from the active file and workspace folders, resolved from the nearest `tsconfig*.json` / `jsconfig*.json`. Add packages as VS Code workspace folders when you want each package to keep its own active server context.
- **Command palette:** `ttsc: Restart language server`, `ttsc: Fix all lint issues`, and `ttsc: Format document`. The lint and format commands need a plugin that provides them, such as `@ttsc/lint`.

The extension's identifier inside VS Code is `samchon.ttsc`.

## Troubleshooting

If TypeScript-Go or ttsc plugin diagnostics don't appear after install:

1. **Check the project has `ttsc`:** `npx ttsc --version`. If this errors, install `ttsc @typescript/native-preview` in the project first.
2. **Check the same config in the CLI:** run `npx ttsc --noEmit -p <selected tsconfig>` from the project root and confirm the plugin diagnostics appear there.
3. **Read the server log:** open **View → Output**, pick **ttsc** from the dropdown.
4. **Restart the server:** command palette → `ttsc: Restart language server`.
5. **Verbose tracing:** set `ttsc.trace.server` to `"verbose"`, then read **View → Output → ttsc (trace)**.

If `npx @ttsc/vscode` errors with `\`code\` CLI not found on PATH`: open VS Code → command palette → **Shell Command: Install 'code' command in PATH**, then retry the install.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
