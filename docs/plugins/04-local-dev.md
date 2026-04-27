# Local Development Setup

`ttsc` builds your plugin for end users on demand. But you, the plugin author, want a *fast inner loop*: write Go code, get autocompletion, run tests, see compile errors in your editor — without going through `ttsc` for every keystroke.

This page sets up the layout that gives you that. The trick is a single `go.work` file in your repo that mirrors the workspace `ttsc` will create at build time, but using *your installed* `ttsc` package as the shim source.

## The full layout

```
my-plugin/
├── package.json                  # has "ttsc" as a devDependency
├── go.work                       # ← this file is the magic
├── plugin.cjs                    # JS manifest
├── go-plugin/
│   ├── go.mod                    # plugin's own Go module
│   └── main.go                   # plugin source (imports shim packages here)
└── node_modules/
    └── ttsc/
        ├── go.mod                # ttsc's own go.mod
        └── shim/
            ├── ast/go.mod
            ├── core/go.mod
            └── ...               # 13 shim modules
```

## Step-by-step

### 1. Install `ttsc` as a devDependency

```bash
npm i -D ttsc
```

This pulls `ttsc` into `node_modules/`. Because `ttsc`'s npm package includes `go.mod` and the entire `shim/` tree in its `files` list, you get a complete shim distribution on disk.

### 2. Write `go.work` at your repo root

```
go 1.26

use (
	./go-plugin
	./node_modules/ttsc
	./node_modules/ttsc/shim/ast
	./node_modules/ttsc/shim/bundled
	./node_modules/ttsc/shim/checker
	./node_modules/ttsc/shim/compiler
	./node_modules/ttsc/shim/core
	./node_modules/ttsc/shim/diagnosticwriter
	./node_modules/ttsc/shim/parser
	./node_modules/ttsc/shim/scanner
	./node_modules/ttsc/shim/tsoptions
	./node_modules/ttsc/shim/tspath
	./node_modules/ttsc/shim/vfs
	./node_modules/ttsc/shim/vfs/cachedvfs
	./node_modules/ttsc/shim/vfs/osvfs
)
```

This file mirrors the overlay `ttsc` writes to its scratch dir at build time. The difference is that here it points at your `node_modules/ttsc/`, which is exactly the same shim source `ttsc` itself will use at build time on your end users' machines.

You can include only the shims you actually use, but listing all of them is harmless — unused `use` entries cost nothing.

> **pnpm / yarn PnP users.** With pnpm's default `node-linker=isolated` layout, `ttsc` does *not* live at `./node_modules/ttsc/` — it lives somewhere like `./node_modules/.pnpm/ttsc@0.4.4/node_modules/ttsc/`. Three workable options:
>
> 1. **Switch to `node-linker=hoisted`** in `.npmrc` for your plugin repo. This gives you the flat `./node_modules/ttsc/` layout the snippet above assumes. Recommended for plugin-development repos — your *published* plugin still works under any package manager because that's the consumer's setup, not yours.
> 2. **Public-hoist `ttsc`.** In `.npmrc`: `public-hoist-pattern[]=ttsc`. This surfaces `ttsc` at the top-level `node_modules/` while keeping the rest of your deps isolated.
> 3. **Resolve at script time.** `node -p "require.resolve('ttsc/package.json')"` gives you the real path; rewrite the `go.work` once after install (e.g. via a `postinstall` script). Brittle — the path changes when ttsc's version does.
>
> yarn classic (v1) hoists by default and works as written. yarn berry with PnP requires `nodeLinker: node-modules`; treat it like pnpm.

### 3. `.gitignore`

```gitignore
# Inside my-plugin/
node_modules/
go.work.sum
```

Keep `go.work` itself in git (your build setup), exclude `go.work.sum` (machine-specific).

### 4. Verify

```bash
go build ./go-plugin
go test ./go-plugin/...
go vet ./go-plugin/...
```

All three should work. If any fail with "no required module provides package github.com/microsoft/typescript-go/shim/X", check that:

- The shim is listed in `go.work`'s `use` block.
- The shim is required in `go-plugin/go.mod` (e.g. `require github.com/microsoft/typescript-go/shim/X v0.0.0`).
- `node_modules/ttsc/shim/X/` actually exists. (If not: `npm i -D ttsc` again.)

### 5. Editor / gopls

`gopls` (the Go language server used by VS Code, Neovim's `nvim-lspconfig`, GoLand, etc.) auto-detects `go.work` files at the repository root. With the layout above, you get full IDE support inside `go-plugin/`:

- Autocompletion on `shimast.`, `shimcore.`, etc.
- Inline type errors when you misuse a shim symbol.
- Jump-to-definition into `node_modules/ttsc/shim/<X>/shim.go`.
- Hover docs on shim types.

If your editor doesn't pick it up, restart the language server. VS Code: `> Go: Restart Language Server`.

## When `ttsc` upgrades

When you bump `ttsc` in `package.json`:

- `node_modules/ttsc/shim/` updates with the new shim layout.
- `go.work`'s `use` paths still point at the right directories — no edit needed.
- If `ttsc` *added* a new shim module (rare), append a `use` line for it. If `ttsc` *removed* one (also rare; would be a `contractVersion` bump), drop the obsolete `use` line.
- Run `go build ./go-plugin` once. If a shim symbol you use was renamed or removed, you get a clear Go compile error pointing at the line. Fix it, ship a new plugin version.

This is the duck-typing payoff in your dev loop: tsgo/ttsc moves, and the diff is in *your* compile errors, not in mysterious runtime mismatches.

## Symmetry with what `ttsc` does at build time

The mental model:

| Where | What happens |
| --- | --- |
| Your repo (dev) | You maintain `go.work` pointing at `./node_modules/ttsc/...` |
| Consumer's machine (prod) | `ttsc` generates an equivalent `go.work` in a scratch dir pointing at `<consumer-node_modules>/ttsc/...` (or a globally installed `ttsc`'s shim) |

Same shape, different roots. That's why your local builds match what consumers get — there's no "dev mode vs prod mode" divergence.

## Future ergonomics

A future `ttsc` release may ship a `ttsc plugin scaffold` (or `init`) command that emits the `package.json`, `plugin.cjs`, `go.mod`, `go.work`, and a starter `main.go` in one shot. Until then, copy-paste from this doc or from [`tests/projects/go-source-plugin-tsgo/`](../../tests/projects/go-source-plugin-tsgo/) (which is the smallest working example in this repo).
