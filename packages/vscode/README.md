# `@ttsc/vscode`

![banner of @ttsc/vscode](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/vscode.svg)](https://www.npmjs.com/package/@ttsc/vscode) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/vscode.svg)](https://www.npmjs.com/package/@ttsc/vscode) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

VS Code extension for [`ttsc`](https://ttsc.dev) projects. It shows TypeScript-Go diagnostics and `@ttsc/lint` lint and format inside your editor.

## Setup

### Requirements

- **VS Code** 1.94 or later
- **Node.js** 18 or later
- **`ttsc`, `@ttsc/lint`, and `@typescript/native-preview` in your project.** `@typescript/native-preview` is the TypeScript-Go engine `ttsc` runs on; it is a separate package that `ttsc` does not bundle.

```bash
npm install -D ttsc @ttsc/lint @typescript/native-preview
```

### Install

Not on the VS Code Marketplace yet. Run `npx @ttsc/vscode`; it downloads the package and installs the bundled `.vsix` into VS Code, nothing to keep as a dependency:

```bash
npx @ttsc/vscode
```

If the `code` CLI isn't on your `PATH`, run **Shell Command: Install 'code' command in PATH** from VS Code's command palette, then re-run `npx @ttsc/vscode`.

### Format on save

Set `samchon.ttsc` as the default formatter and turn on `editor.formatOnSave` in `.vscode/settings.json`:

```jsonc
"[typescript][typescriptreact]": {
  "editor.defaultFormatter": "samchon.ttsc",
  "editor.formatOnSave": true
}
```

Lint **fixes** stay off-save by default because they can change code meaning. Run `ttsc: Fix all lint issues` from the command palette, or opt in with `"editor.codeActionsOnSave": { "source.fixAll.ttsc": "explicit" }`.

The format rules come from your project's `lint.config`, so format-on-save does nothing until that config has a `format` block.

## What it adds

- TypeScript-Go diagnostics, hover, navigation, and completions.
- `@ttsc/lint` lint diagnostics, plus `ttsc: Fix all lint issues` and `ttsc: Format document` in the command palette.
- Format on save with `@ttsc/lint`'s rules, shown above.
- Monorepo-aware: each package uses its own `tsconfig` and `lint.config`.

## Troubleshooting

No diagnostics? Confirm `ttsc` runs in the project (`npx ttsc --version`), then check **View → Output → ttsc** for the server log. For LSP tracing, set `ttsc.trace.server` to `"verbose"`.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.png)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
