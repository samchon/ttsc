# `@ttsc/vscode`

![banner of @ttsc/vscode](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

MIT licensed · [npm](https://www.npmjs.com/package/@ttsc/vscode) · [docs](https://ttsc.dev/docs) · [Discord](https://discord.gg/E94XhzrUCZ)

VSCode extension for [`ttsc`](https://ttsc.dev) projects.

Lint diagnostics, format hints, and plugin code actions appear in your editor live — the same diagnostics `ttsc` would emit at build time, shown as you type.

## Requirements

- **VS Code** 1.94 or later
- **Node.js** 18 or later
- **`ttsc` installed in your project** — the extension uses the language server that ships with your project's `ttsc` package

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
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

The extension activates on any TypeScript, JavaScript, TSX, or JSX file inside a project that has `ttsc` installed.

- **Live lint underlines.** Violations from `@ttsc/lint` (and any third-party rule plugins you've installed) appear in the same gutter as TypeScript type errors — same `error TSxxxxx` shape.
- **Quick fixes** for autofixable rules under the lightbulb menu.
- **Command palette entries:**
  - `ttsc: Apply lint fixes to current file`
  - `ttsc: Format current document`
  - `ttsc: Restart language server`

The extension's identifier inside VS Code is `samchon.ttsc`.

## Settings

Open VS Code's settings (`Ctrl+,` / `Cmd+,`) and search for `ttsc`, or edit `settings.json` directly:

| Setting | Default | Effect |
| --- | --- | --- |
| `ttsc.serverPath` | `""` | Absolute path to a language-server binary. Empty means use the one bundled with the project's `ttsc` install — almost always what you want. |
| `ttsc.trace.server` | `"off"` | Set to `"messages"` or `"verbose"` to log LSP traffic. The log goes to **View → Output → ttsc**. Useful when diagnostics don't show up. |

## Troubleshooting

If lint underlines don't appear after install:

1. **Check the project has `ttsc`:** `npx ttsc --version`. If this errors, install `ttsc @ttsc/lint @typescript/native-preview` in the project first.
2. **Read the server log:** open **View → Output**, pick **ttsc** from the dropdown.
3. **Restart the server:** command palette → `ttsc: Restart language server`.
4. **Verbose tracing:** set `ttsc.trace.server` to `"verbose"`, repeat step 2.

If `npx ttsc-vscode` errors with `\`code\` CLI not found on PATH`: open VS Code → command palette → **Shell Command: Install 'code' command in PATH**, then retry the install.
