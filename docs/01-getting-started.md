# Getting Started: Smallest Useful Transform Plugin

This page builds a source transform plugin that removes `debugger` statements from TypeScript AST before TypeScript-Go emits JavaScript and declarations.

After this works, compare it with the shipped [`@ttsc/strip`](../packages/strip/) and [`@ttsc/banner`](../packages/banner/) plugins.

## 1. Create the Package

```text
ttsc-plugin-debugger-strip/
|- package.json
|- plugin.cjs
`- go-plugin/
   |- go.mod
   `- main.go
```

`package.json`:

```json
{
  "name": "ttsc-plugin-debugger-strip",
  "version": "0.1.0",
  "main": "plugin.cjs",
  "ttsc": {
    "plugin": {
      "transform": "ttsc-plugin-debugger-strip"
    }
  },
  "files": ["plugin.cjs", "go-plugin"],
  "engines": {
    "node": ">=18"
  }
}
```

The `files` field includes the Go source because `ttsc` builds it on the consumer machine. Published plugin manifests keep `ttsc` and `@typescript/native-preview` out of package dependencies; the consumer project supplies the active host and TypeScript-Go runtime.

`ttsc.plugin` is a package-level auto-discovery marker. `ttsc` reads it only from packages listed directly in the nearest consumer `package.json` at or above the selected project. A matching `compilerOptions.plugins[]` entry in `tsconfig.json` takes priority.

## 2. Write the Descriptor

`plugin.cjs`:

```js
const path = require("node:path");

module.exports = function createDebuggerStripPlugin() {
  return {
    name: "ttsc-plugin-debugger-strip",
    source: path.resolve(__dirname, "go-plugin"),
    stage: "transform",
  };
};
```

Important fields:

- `name`: human-readable plugin name for errors and logs.
- `source`: Go command package directory.
- `stage: "transform"`: participate in the TypeScript-Go transform path.

There is no `output` stage. Generated JavaScript text is not the plugin API.

## 3. Write the Go Module

`go-plugin/go.mod`:

```text
module ttsc-plugin-debugger-strip

go 1.26

require (
	github.com/samchon/ttsc/packages/ttsc v0.0.0
	github.com/microsoft/typescript-go/shim/ast v0.0.0
)
```

`ttsc` supplies these `v0.0.0` modules through its generated `go.work` overlay while it builds the plugin. Add a `require` line for every shim package your plugin imports. Host-managed module paths stay on the `ttsc` overlay; plugin-specific helper packages live under the plugin's own module path.

## 4. Implement the Plugin Commands

`go-plugin/main.go`:

```go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

type options struct {
	cwd      string
	emit     bool
	noEmit   bool
	outDir   string
	tsconfig string
}

type transformResult struct {
	Diagnostics []any             `json:"diagnostics,omitempty"`
	TypeScript  map[string]string `json:"typescript"`
}

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "ttsc-plugin-debugger-strip: command required")
		return 2
	}
	switch args[0] {
	case "version", "-v", "--version":
		fmt.Fprintln(os.Stdout, "ttsc-plugin-debugger-strip 0.1.0")
		return 0
	case "check":
		return 0
	case "transform":
		return runTransform(args[1:])
	case "build":
		return runBuild(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "ttsc-plugin-debugger-strip: unknown command %q\n", args[0])
		return 2
	}
}

func runBuild(args []string) int {
	opts, ok := parseOptions("build", args)
	if !ok {
		return 2
	}
	prog, ok := loadProgram(opts)
	if !ok {
		return 2
	}
	defer prog.Close()
	stripProgram(prog)
	if opts.noEmit {
		return 0
	}
	_, emitDiags, err := prog.EmitAllRaw(nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-plugin-debugger-strip: emit failed: %v\n", err)
		return 3
	}
	for _, diag := range emitDiags {
		fmt.Fprintln(os.Stderr, diag.String())
	}
	if len(emitDiags) > 0 {
		return 2
	}
	return 0
}

func runTransform(args []string) int {
	opts, ok := parseOptions("transform", args)
	if !ok {
		return 2
	}
	prog, ok := loadProgram(opts)
	if !ok {
		return 2
	}
	defer prog.Close()
	stripProgram(prog)
	out := transformResult{TypeScript: map[string]string{}}
	for _, file := range prog.SourceFiles() {
		out.TypeScript[outputKey(opts.cwd, file.FileName())] = file.Text()
	}
	data, err := json.Marshal(out)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-plugin-debugger-strip: transform marshal failed: %v\n", err)
		return 3
	}
	fmt.Fprintln(os.Stdout, string(data))
	return 0
}

func parseOptions(command string, args []string) (options, bool) {
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "project directory")
	emit := fs.Bool("emit", false, "force emit")
	noEmit := fs.Bool("noEmit", false, "force no emit")
	outDir := fs.String("outDir", "", "emit directory override")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "project tsconfig")
	_ = fs.String("plugins-json", "", "ttsc plugin metadata")
	_ = fs.Bool("quiet", true, "suppress summary")
	_ = fs.Bool("verbose", false, "print summary")
	if err := fs.Parse(args); err != nil {
		return options{}, false
	}

	root := *cwd
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return options{}, false
		}
	}
	if !filepath.IsAbs(root) {
		abs, err := filepath.Abs(root)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return options{}, false
		}
		root = abs
	}
	return options{
		cwd:      filepath.Clean(root),
		emit:     *emit,
		noEmit:   *noEmit,
		outDir:   *outDir,
		tsconfig: *tsconfig,
	}, true
}

func loadProgram(opts options) (*driver.Program, bool) {
	prog, parseDiags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
		ForceEmit:   opts.emit,
		ForceNoEmit: opts.noEmit,
		OutDir:      opts.outDir,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-plugin-debugger-strip: %v\n", err)
		return nil, false
	}
	if len(parseDiags) > 0 {
		driver.WritePrettyDiagnostics(os.Stderr, parseDiags, opts.cwd)
		prog.Close()
		return nil, false
	}
	if diags := prog.Diagnostics(); len(diags) > 0 {
		driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
		prog.Close()
		return nil, false
	}
	return prog, true
}

func stripProgram(prog *driver.Program) {
	for _, file := range prog.SourceFiles() {
		removeDebuggers(file.Statements)
	}
}

func outputKey(cwd, fileName string) string {
	rel, err := filepath.Rel(cwd, fileName)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return filepath.ToSlash(fileName)
	}
	return filepath.ToSlash(rel)
}

func removeDebuggers(list *shimast.NodeList) {
	if list == nil || len(list.Nodes) == 0 {
		return
	}
	out := list.Nodes[:0]
	for _, stmt := range list.Nodes {
		if stmt.Kind == shimast.KindDebuggerStatement {
			continue
		}
		removeDebuggersFromChildren(stmt)
		out = append(out, stmt)
	}
	list.Nodes = out
}

func removeDebuggersFromChildren(node *shimast.Node) {
	if node == nil {
		return
	}
	if node.CanHaveStatements() {
		removeDebuggers(node.StatementList())
	}
	node.ForEachChild(func(child *shimast.Node) bool {
		removeDebuggersFromChildren(child)
		return false
	})
}
```

What matters:

- The plugin changes TypeScript AST, not emitted text.
- `driver.LoadProgram` lets TypeScript-Go parse and typecheck the real project.
- `EmitAllRaw` lets TypeScript-Go own JavaScript, declaration, and source-map printing after the AST mutation.
- Optional flags are accepted even when unused. Future `ttsc` minors may add more optional flags.

## 5. Use It

Consumer install:

```bash
npm i -D ttsc @typescript/native-preview /path/to/ttsc-plugin-debugger-strip
```

Consumer `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
  },
  "include": ["src"],
}
```

Consumer `src/main.ts`:

```ts
debugger;

export const value = 1;
```

Run:

```bash
npx ttsc --emit
```

The first run builds and caches the Go binary. Later runs reuse it until the plugin source, `ttsc` version, TypeScript-Go version, platform, or source entry changes. The emitted `dist/main.js` should contain `value` but not the `debugger` statement.

## Next Step

For production-quality versions of this shape, read [`packages/strip`](../packages/strip/) and [`packages/banner`](../packages/banner/). For copyable helper patterns, use [Recipes](./08-recipes.md). If the build fails, check [Pitfalls](./09-pitfalls.md). For deeper AST and checker work, continue to [AST and Checker](./03-tsgo.md).
