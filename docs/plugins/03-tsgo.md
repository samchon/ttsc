# Importing tsgo APIs

Most non-trivial plugins need to look at the user's TypeScript through `typescript-go`'s eyes — read the AST, walk the type graph, ask the Checker about a node. This page is about how to do that from your plugin source.

## The model in one paragraph

`ttsc` ships *shim* modules — narrow Go packages that re-export selected symbols from `typescript-go`'s internal packages. Your plugin imports the shim. When `ttsc` builds your plugin, it generates a Go workspace (`go.work`) that wires every shim module *plus the `ttsc` package itself* in as workspace members. Your plugin's imports of `github.com/microsoft/typescript-go/shim/...` resolve to the exact shim version `ttsc` is pinned against. There is no version coordination to worry about and no module proxy step.

This is the mechanism that gives the project its "duck typing" property: your plugin only depends on the shim symbols it actually uses, and unrelated changes to other shims don't affect you.

## What's in the shim

The shim modules live under `<ttsc-package>/shim/`. Each one is a regular Go module re-exporting a curated slice of `typescript-go` internals. As of this writing:

| Shim module | Purpose |
| --- | --- |
| `shim/ast` | TypeScript AST nodes (`ast.Node`, `ast.SourceFile`, `KindXxx` constants, `GetNodeAtPosition`, …) |
| `shim/checker` | Type checker (`Checker`, `GetTypeAtLocation`, type APIs) |
| `shim/compiler` | Program creation, emit pipeline, write-file callbacks |
| `shim/core` | Foundational types (`CompilerOptions`, `Tristate`, `TSTrue`/`TSFalse`) |
| `shim/parser` | Parse helpers |
| `shim/scanner` | Position/line math, lexer hooks, escape-sequence flags |
| `shim/tsoptions` | tsconfig.json parsing (`ParsedCommandLine`, `GetParsedCommandLineOfConfigFile`) |
| `shim/tspath` | Path helpers (`ResolvePath`) |
| `shim/vfs`, `shim/vfs/cachedvfs`, `shim/vfs/osvfs` | Virtual filesystem abstraction |
| `shim/diagnosticwriter` | Diagnostic formatting (`FormatASTDiagnosticsWithColorAndContext`) |
| `shim/bundled` | `tsgo`'s bundled lib.d.ts files |

Each shim is a separately-importable Go package: `github.com/microsoft/typescript-go/shim/<name>`. The exact set of exported symbols is whatever's in that shim's `shim.go` (and `extra-shim.json` for hand-curated additions). The set may grow but won't shrink within `contractVersion: 1`.

## How to use a shim — the current rules

Two things have to be true for `ttsc` to compile your plugin against a shim.

### 1. Import it from your `.go` files normally

```go
import (
    shimast "github.com/microsoft/typescript-go/shim/ast"
    shimcore "github.com/microsoft/typescript-go/shim/core"
)

func transform(file *shimast.SourceFile) {
    // …
}
```

### 2. Declare a require in your `go.mod`

```
module my-plugin

go 1.26

require (
    github.com/microsoft/typescript-go/shim/ast v0.0.0
    github.com/microsoft/typescript-go/shim/core v0.0.0
)
```

The `v0.0.0` is a placeholder version: the shim modules ship *inside the `ttsc` npm package*, not on the Go module proxy, so a real semver tag would be misleading. Resolution is supplied by a `go.work` overlay — at build time `ttsc` synthesizes one in a scratch dir; for *your* dev loop you write one yourself in your repo. See [local-dev.md](./04-local-dev.md) for the layout.

The `require` line still has to exist. Go workspace mode looks up modules by import path, but every package your code imports must appear in some `go.mod`'s `require` list — that's what tells the toolchain "this package is part of my dep graph". With your local `go.work` set up, gopls, `go build`, `go test`, and `go vet` all resolve the shim correctly.

## A working example

The fixture at [`tests/projects/go-source-plugin-tsgo/`](../../tests/projects/go-source-plugin-tsgo/) is the smallest tsgo-importing plugin in the codebase. The relevant pieces are:

`go-plugin/go.mod`:
```
module go-source-plugin-tsgo

go 1.26

require github.com/microsoft/typescript-go/shim/core v0.0.0
```

`go-plugin/main.go` (excerpt):
```go
import shimcore "github.com/microsoft/typescript-go/shim/core"

func transform(source string) (string, error) {
    // ... existing transform logic ...
    if shimcore.TSTrue != shimcore.TSFalse {
        value += " (tsgo)"
    }
    // ...
}
```

That import resolves at build time to `<ttsc-package>/shim/core/shim.go`. The smoke test (`plugin corpus: source plugin can import tsgo shim modules via go.work overlay`) verifies the resulting binary actually runs and the comparison evaluates as expected.

## What you can and can't do

**Yes, you can:**
- Import any combination of the shim modules listed above.
- Use any symbol the shim re-exports (`shim.go` is the source of truth).
- Mix shim imports with normal third-party Go modules in your `go.mod`.

**No, you can't (or shouldn't):**
- Import `github.com/microsoft/typescript-go/internal/...` directly. The shim is the public boundary. Internal paths are unstable and not wired into the `go.work` overlay.
- Pin a real semver on shim requires (`v1.2.3` etc.). Use `v0.0.0` until shims gain a publish surface.
- Vendor the shim into your repo. The whole point of source-on-demand compilation is that `ttsc` provides the matching shim at build time.

## Bootstrapping a Program and a Checker

The shim re-exports types and helpers, but it does **not** hand you a running tsgo `Program` or `Checker` directly. Your plugin gets a `--file` path and a `--tsconfig` path on the command line; whatever heavy machinery you need (typed AST traversal, `Checker.GetTypeOfSymbol`, etc.), you build yourself from those flags.

The pattern below mirrors what `ttsc`'s own driver does internally. Adapt freely; the only step you can't skip is using `bundled.WrapFS` and `bundled.LibPath()` so tsgo's `lib.es*.d.ts` files resolve without a network fetch.

```go
import (
    "context"
    "fmt"

    "github.com/microsoft/typescript-go/shim/bundled"
    shimchecker "github.com/microsoft/typescript-go/shim/checker"
    shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
    "github.com/microsoft/typescript-go/shim/core"
    "github.com/microsoft/typescript-go/shim/tsoptions"
    "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
    "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// bootstrap returns a running Program + Checker for the consumer's
// tsconfig. The caller MUST defer the returned release function to
// free the checker pool lease.
func bootstrap(cwd, tsconfigPath string) (*shimcompiler.Program, *shimchecker.Checker, func(), error) {
    fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
    host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)

    parsed, _ := tsoptions.GetParsedCommandLineOfConfigFile(
        tsconfigPath,
        &core.CompilerOptions{},
        nil,
        host,
        nil,
    )
    if parsed == nil {
        return nil, nil, nil, fmt.Errorf("tsoptions: parsed command line was nil for %s", tsconfigPath)
    }
    if len(parsed.Errors) > 0 {
        return nil, nil, nil, fmt.Errorf("tsoptions: %d diagnostics parsing %s", len(parsed.Errors), tsconfigPath)
    }

    program := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
        Config:                      parsed,
        SingleThreaded:              core.TSTrue,
        Host:                        host,
        UseSourceOfProjectReference: true,
    })
    if program == nil {
        return nil, nil, nil, fmt.Errorf("compiler: NewProgram returned nil")
    }

    checker, release := program.GetTypeChecker(context.Background())
    return program, (*shimchecker.Checker)(checker), release, nil
}
```

What you have after `bootstrap` returns:

- `program.SourceFiles()` — every parsed source file. Walk it to find the one matching your `--file` argument (compare with `filepath.ToSlash` for cross-platform safety).
- A `*shimchecker.Checker` — call any `shimchecker.Checker_xxx` helper on it, or any direct method on `innerchecker.Checker` exposed by the shim.
- The full tsgo dep graph: types, symbols, lib files. From here you do whatever your plugin actually does — schema generation, runtime validators, code generation from generic type arguments, etc.

The release callback frees a checker-pool lease that tsgo holds internally. Always `defer release()` after acquisition; otherwise repeated invocations of your binary will exhaust the pool.

### Locate the right source file

```go
target := filepath.ToSlash(*fileFlag) // the --file argument, normalized
for _, file := range program.SourceFiles() {
    if filepath.ToSlash(file.FileName()) == target {
        // file.Text() gives the source string
        // file is *shimast.SourceFile — walk it however you like
        break
    }
}
```

### A complete working example: bootstrap

[`tests/projects/go-source-plugin-checker/`](../../tests/projects/go-source-plugin-checker/) is the smallest plugin in this repo that exercises the full bootstrap. It:

1. Parses `--file`, `--tsconfig`, `--cwd` from the CLI.
2. Bootstraps Program + Checker with the helper above.
3. Locates the target source file in `program.SourceFiles()`.
4. Recognizes call sites shaped like `__typeText<T>()` and emits the source text of `T` as a string literal.

The transform itself stays at the source-text level on purpose — that fixture's takeaway is the bootstrap pattern, not the trick used downstream.

## Walking the AST

Once you have a `Program`, traversal is plain Go. Every `*shimast.SourceFile` has a `Statements *NodeList` with a `Nodes []*Node` slice; every `*shimast.Node` has a `Kind` field and typed accessor methods (`AsInterfaceDeclaration`, `AsCallExpression`, etc.) that return `nil` when the kind doesn't match.

The pattern, end to end:

```go
for _, file := range program.SourceFiles() {
    if file.IsDeclarationFile {
        continue // skip lib.es*.d.ts and friends
    }
    for _, stmt := range file.Statements.Nodes {
        switch stmt.Kind {
        case shimast.KindInterfaceDeclaration:
            decl := stmt.AsInterfaceDeclaration()
            handleInterface(decl)
        case shimast.KindTypeAliasDeclaration:
            decl := stmt.AsTypeAliasDeclaration()
            handleTypeAlias(decl)
        // …
        }
    }
}

func handleInterface(decl *shimast.InterfaceDeclaration) {
    if decl == nil || decl.Name() == nil || decl.Members == nil {
        return
    }
    name := decl.Name().Text()
    for _, member := range decl.Members.Nodes {
        if member.Kind != shimast.KindPropertySignature {
            continue
        }
        prop := member.AsPropertySignatureDeclaration()
        if prop == nil || prop.Name() == nil {
            continue
        }
        propName := prop.Name().Text()
        _ = propName
        // … decide what to do with this property
    }
}
```

What's available on a `*Node`:

- `node.Kind` — `Kind` enum value; compare against `shimast.Kind*` constants.
- `node.AsX()` — typed accessor for kind `X`. Returns the typed pointer if `node.Kind == shimast.KindX`, otherwise `nil`. Always nil-check.
- `node.Symbol()` — the binder-assigned symbol for declarations. Useful when paired with `Checker_xxx` helpers below.
- `node.Pos()`, `node.End()` — source positions; combine with `file.Text()[pos:end]` to get raw source text.
- `node.Parent` — walk up the tree.

You can also recurse into a node's children via the typed accessors (e.g. `decl.Members.Nodes` for an `InterfaceDeclaration`'s members, `call.Arguments.Nodes` for a `CallExpression`'s arguments). The shim does not currently expose `node.ForEachChild`; iterate the typed accessor lists instead.

### Querying the Checker

`shim/checker` exposes a deliberate subset of `*Checker` methods. The most useful ones for typia-class plugins:

- `shimchecker.Checker_getPropertiesOfType(checker, type) []*Symbol` — every property the type declares (no inheritance walking).
- `shimchecker.Checker_getApparentProperties(checker, type) []*Symbol` — every property the type *exposes*, including inherited members from `extends` and merged interfaces. This is what most semantic plugins want.
- `shimchecker.Checker_getTypeOfSymbolAtLocation(checker, symbol, location) *Type` — resolve a symbol's type at a given AST location. Use this when you have a value-level symbol (e.g. a variable) and want its type.
- `shimchecker.Checker_getTypeArguments(checker, type) []*Type` — generic type arguments at an instantiation site.
- `shimchecker.Checker_resolveEntityName(checker, nameNode, meaning, ignoreErrors, dontResolveAlias, location) *Symbol` — look up a name (identifier or qualified) into a symbol.
- `shimchecker.Checker_isArrayType(checker, type) bool`, `shimchecker.IsTupleType(type)`, `shimchecker.Type_getTypeNameSymbol(type)` — narrowing helpers.

A `*Symbol` from any of these has a `.Name` field — the property name as a string. Symbols also have flags, declarations, and parents accessible via methods on the alias type.

Heads-up: there is no `Checker.GetTypeFromTypeNode` exposed in the shim today. To turn a `<T>` type argument into a `*Type` you typically resolve through the symbol path (`Checker_resolveEntityName` on the type's name node, then `Checker_getTypeOfSymbolAtLocation`), or fall back to AST-level reasoning when that's enough. If your plugin truly needs type-from-typenode for something AST can't answer, request it as a shim addition.

### A complete working example: AST + Checker

[`tests/projects/go-source-plugin-properties/`](../../tests/projects/go-source-plugin-properties/) is the next step up from the bootstrap fixture. It:

1. Bootstraps `Program` + `Checker` (same helper as above).
2. Walks every user `SourceFile`'s top-level statements.
3. For each `InterfaceDeclaration`, enumerates `PropertySignature` members and records their names.
4. Replaces every `typeProperties<T>()` call with the JSON-serialized property list.

Source:
```ts
interface User { id: number; email: string; name: string; }
interface Product { sku: string; price: number; }

export const userProps: readonly string[] = typeProperties<User>();
export const productProps: readonly string[] = typeProperties<Product>();
```

After:
```js
exports.userProps = ["id","email","name"];
exports.productProps = ["sku","price"];
```

The fixture stays at the AST level for property enumeration because that's the most direct path for declaration-level extraction. When you need *resolved* types — e.g. to follow `extends` clauses, expand mapped types, or resolve generics — that's where the `Checker_xxx` helpers above plug in. The bootstrap reaches a usable Checker; everything past that is the ordinary type-checker workflow.

## When `tsgo` upgrades

When `ttsc` bumps its pinned `@typescript/native-preview`, the bundled shims change to match. Your plugin's *source* doesn't move. Three outcomes:

1. **No symbol you use changed** → next build is a cache miss (different `tsgoVersion` in the cache key), but the source compiles fine and the new binary works. *This is the common case — that's the duck-typing payoff.*
2. **A symbol you use was renamed or removed** → next build fails with a clear Go compile error pointing at the offending line. You ship a new plugin version.
3. **A symbol's *signature* changed** → same as #2 — Go catches it at compile time.

You'll never get a silent runtime mismatch. That's the whole reason `ttsc` builds plugins from source rather than accepting precompiled binaries.

## Why the manual `require` is correct (not auto-injected)

A tempting shortcut: `ttsc` could scan your plugin's imports at build time and synthesize the `require` lines itself, so your `go.mod` would only need `module foo` and `go 1.26`. Convenient. Wrong choice — and it's worth being explicit about why, because the surface alone makes it look attractive.

The `go.mod` in your plugin isn't only consumed by `ttsc`'s build pipeline. It's consumed by:

- **`gopls`** (your editor's language server). Without a `require` for `shim/core`, gopls reports "no required module provides package ..." on every line that uses it. No autocompletion on `shimcore.`, no jump-to-definition, no inline type errors. You'd be writing tsgo-using Go code in a broken editor.
- **`go build` / `go test` / `go vet` / `gofmt`** standalone in your dev loop. All of these read `go.mod` directly. Without the require, they all fail outside `ttsc`'s overlay. Your inner loop would be "edit, run `ttsc`, wait, repeat" — death by a thousand seconds.
- **`go mod tidy`**, linters, IDE refactor tools, and every other piece of the Go ecosystem that operates on a module's declared deps.

If `ttsc` auto-injected requires only at build time, the developer experience would *look* clean (less to write) but every dev tool around the plugin source would silently break. That's a worse trade than asking the author to type one require line per shim they actually use.

The "v0.0.0 looks weird" complaint is real but solvable through documentation, not magic. With a local `go.work` pointed at `./node_modules/ttsc/shim/...` (see [local-dev.md](./04-local-dev.md)), the placeholder version becomes invisible: gopls resolves the shim through workspace mode, the version string never gets dereferenced, and every Go tool just works.

So the rule stays: you import what you need, you declare the require with `v0.0.0`, and you wire your local `go.work` once. The ceremony pays for itself in IDE support.
