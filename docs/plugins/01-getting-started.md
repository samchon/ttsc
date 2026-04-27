# Getting Started: Hello-World Plugin

This page walks through building a minimal `ttsc` plugin that uppercases the contents of a custom `goUpper("...")` call site in the consumer's TypeScript. By the end you'll have a working npm package that real consumers can install.

## What a plugin actually does

Before the steps, the mental model:

- Your plugin **does not replace `tsgo`**. `tsgo` is still the compiler. Your plugin runs as a side process that `ttsc` invokes on each `.ts` file (or once per project build) to *rewrite the output JavaScript* before it lands on disk.
- Your plugin **does not have to invent a magic syntax**. The example below pattern-matches a literal `goUpper("...")` call to keep the demo readable, but a real plugin is more often something like *"find every call to `MyLib.is<T>(value)` and emit a runtime type-validator based on `T`"*. Both are valid; they just differ in how much they lean on the TypeScript AST and Checker.
- Your plugin **gets the user's TypeScript context**. `ttsc` passes you the source file path and the tsconfig path. From there you can stay at the source-text level (this page) or bootstrap a real `Program` + `Checker` and do semantic work ([03-tsgo.md](./03-tsgo.md#bootstrapping-a-program-and-a-checker)).

This guide stays at the source-text level. Once you have it working, [03-tsgo.md](./03-tsgo.md) shows how to graduate to AST/Checker-driven plugins.

## Prerequisites

- Node.js ≥ 18
- Go ≥ 1.26 (`go version` should print something)
- An empty workspace where you can scaffold a new package

> The Go toolchain is needed *on the consumer's machine*, not on yours, but it's needed on yours too if you want to test locally.

## Project layout

A `ttsc` plugin npm package looks like this:

```
ttsc-plugin-uppercase/
├── package.json
├── plugin.cjs              # JS manifest — entry referenced from tsconfig
├── go-plugin/
│   ├── go.mod
│   └── main.go             # Go transformer implementation
└── README.md
```

The npm package contains both halves. ttsc reads the manifest at config-parse time and compiles `go-plugin/` on first use.

## 1. `package.json`

```json
{
  "name": "ttsc-plugin-uppercase",
  "version": "0.1.0",
  "main": "plugin.cjs",
  "files": ["plugin.cjs", "go-plugin"],
  "peerDependencies": {
    "ttsc": "^0.4.0"
  }
}
```

The `files` array **must** include `go-plugin/` — your Go source ships in the published tarball. Without it, end-user installs will fail with "native.source.dir does not exist".

## 2. JS manifest — `plugin.cjs`

```js
const path = require("node:path");

module.exports = {
  name: "ttsc-plugin-uppercase",
  native: {
    mode: "uppercase",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
    },
    contractVersion: 1,
  },
};
```

What the fields mean:

- `name` — identifies your plugin in error messages and ordered pipelines.
- `native.mode` — a string your binary uses to dispatch transform behavior. Pick something namespaced like `"acme.uppercase"` to avoid clashing with other plugins running in the same project.
- `native.source.dir` — absolute path to the Go module ttsc should compile. Always use `path.resolve(__dirname, ...)` so the resolution survives being installed under `node_modules/`.
- `native.contractVersion` — the protocol version your plugin speaks. Currently `1`.

See [protocol.md](./02-protocol.md#manifest) for every supported manifest field.

## 3. Go module — `go-plugin/go.mod`

```
module ttsc-plugin-uppercase

go 1.26
```

Your plugin's `go.mod` only needs the module name and `go` directive when you're not importing anything from `ttsc`'s shim. Add `require` lines if you import other Go packages — see [tsgo.md](./03-tsgo.md) for `typescript-go` imports specifically.

## 4. Plugin binary — `go-plugin/main.go`

```go
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var goUpperCall = regexp.MustCompile(
	`(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*goUpper\("([^"]*)"\)\s*;`,
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "ttsc-plugin-uppercase: command required")
		return 2
	}
	switch args[0] {
	case "version", "-v", "--version":
		fmt.Fprintln(os.Stdout, "ttsc-plugin-uppercase 0.1.0")
		return 0
	case "check":
		return 0
	case "transform":
		return runTransform(args[1:])
	case "build":
		return runBuild(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "ttsc-plugin-uppercase: unknown command %q\n", args[0])
		return 2
	}
}

func runTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "")
	out := fs.String("out", "", "")
	_ = fs.String("tsconfig", "", "")
	_ = fs.String("rewrite-mode", "", "")
	_ = fs.String("plugins-json", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	source, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code, err := transform(string(source))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if *out != "" {
		os.MkdirAll(filepath.Dir(*out), 0o755)
		return writeOut(*out, code)
	}
	fmt.Fprint(os.Stdout, code)
	return 0
}

func runBuild(args []string) int {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	_ = fs.String("tsconfig", "", "")
	_ = fs.String("rewrite-mode", "", "")
	_ = fs.String("plugins-json", "", "")
	_ = fs.Bool("emit", false, "")
	_ = fs.Bool("noEmit", false, "")
	_ = fs.Bool("quiet", false, "")
	_ = fs.Bool("verbose", false, "")
	outDir := fs.String("outDir", "dist", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	root := *cwd
	if root == "" {
		root, _ = os.Getwd()
	}
	source := filepath.Join(root, "src", "main.ts")
	text, err := os.ReadFile(source)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code, err := transform(string(text))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	out := filepath.Join(root, *outDir, "main.js")
	if filepath.IsAbs(*outDir) {
		out = filepath.Join(*outDir, "main.js")
	}
	os.MkdirAll(filepath.Dir(out), 0o755)
	return writeOut(out, code)
}

func transform(source string) (string, error) {
	match := goUpperCall.FindStringSubmatch(source)
	if match == nil {
		return "", fmt.Errorf(`ttsc-plugin-uppercase: expected goUpper("...")`)
	}
	name := match[1]
	value := strings.ToUpper(match[2])

	var b strings.Builder
	b.WriteString(`"use strict";` + "\n")
	b.WriteString(`Object.defineProperty(exports, "__esModule", { value: true });` + "\n")
	b.WriteString(fmt.Sprintf("exports.%s = void 0;\n", name))
	b.WriteString(fmt.Sprintf("const %s = %q;\n", name, value))
	b.WriteString(fmt.Sprintf("exports.%s = %s;\n", name, name))
	if strings.Contains(source, "console.log("+name+")") ||
		strings.Contains(source, "console.log("+name+");") {
		b.WriteString(fmt.Sprintf("console.log(%s);\n", name))
	}
	return b.String(), nil
}

func writeOut(path, content string) int {
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return 0
}
```

This is the minimum surface every plugin binary must have:

- `version` — diagnostic output. ttsc may probe this in the future.
- `check` — analysis-only, no emit. ttsc invokes this when `--noEmit` is set.
- `transform --file=X` — single-file transform; result on stdout (or `--out=Y` if provided).
- `build --cwd=X` — project-wide build; writes outputs to disk.

A real plugin parses `--plugins-json` for ordered behavior — see [protocol.md](./02-protocol.md#cli-protocol).

## 5. Try it from a consumer project

In any other directory:

```bash
mkdir consumer && cd consumer
npm init -y
npm i -D ttsc @typescript/native-preview /path/to/ttsc-plugin-uppercase
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "plugins": [{ "transform": "ttsc-plugin-uppercase" }]
  },
  "include": ["src"]
}
```

Create `src/main.ts`:

```ts
export const value: string = goUpper("hello");
console.log(value);
```

Then:

```bash
npx ttsc --emit
node dist/main.js
# → HELLO
```

The first run prints `ttsc: building source plugin "ttsc-plugin-uppercase" ...` to stderr (one-time per cache key); subsequent runs hit the cache and start instantly.

## Optional: typed manifest with `definePlugin`

The `plugin.cjs` above is plain JavaScript — easy to copy-paste, but you get no type checking on the manifest fields. If you'd rather author the manifest in TypeScript, `ttsc` exports a `definePlugin<T>(plugin: T): T` identity helper that gives you full type inference:

```ts
// plugin.ts
import * as path from "node:path";
import { definePlugin } from "ttsc";

export default definePlugin({
  name: "ttsc-plugin-uppercase",
  native: {
    mode: "uppercase",
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
});
```

Build it once with `tsc` (or your preferred TS pipeline) into `lib/plugin.js` and point `package.json`'s `main` at the built file. Consumers reference your plugin the same way; the only thing that changes is that *you* get a typo on `nativ:` flagged at author time.

You can also use the factory form to receive each tsconfig entry's full config:

```ts
import { definePlugin, type ProjectPluginConfig } from "ttsc";

export default definePlugin((entry: ProjectPluginConfig) => ({
  name: entry.name as string,
  native: {
    mode: (entry.mode as string) ?? "uppercase",
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
}));
```

Whichever shape you pick, the runtime semantics are identical to the `.cjs` version. See [02-protocol.md#manifest](./02-protocol.md#manifest) for the full type surface.

## What to read next

- **Make your plugin actually useful (semantic transforms)** — [03-tsgo.md](./03-tsgo.md) shows how to import the TypeScript-Go AST/Checker/Scanner, with two reference fixtures: bootstrap-only and full AST walking.
- **Handle ordered pipelines and config** — [02-protocol.md#cli-protocol](./02-protocol.md#cli-protocol) documents `--plugins-json`, including how user-supplied tsconfig fields like `{ "transform": "...", "myOption": 42 }` arrive in your binary.
- **Set up your dev loop with full IDE support** — [04-local-dev.md](./04-local-dev.md) walks through the local `go.work` so gopls / `go build` / `go test` all work standalone (only needed if you import tsgo shims).
- **Debug build failures** — [05-internals.md](./05-internals.md) describes the cache layout and how to inspect what `ttsc` is doing under the hood.
- **Common patterns** — [08-recipes.md](./08-recipes.md) covers multi-mode dispatch, reading config, diagnostics, watch mode, source maps.
- **First-contact mistakes** — [09-pitfalls.md](./09-pitfalls.md) — skim once, save an hour.
- **Ship to npm** — [06-publishing.md](./06-publishing.md) walks `package.json`, `peerDependencies`, the `files` gotcha, and the publish checklist.
- **Test your plugin** — [07-testing.md](./07-testing.md) — Go unit tests for transform logic + integration tests via `ttsc`.
