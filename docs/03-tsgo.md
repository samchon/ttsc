# AST and Checker Guide

This is the deep plugin-author chapter. Read it when your plugin needs to understand TypeScript source, walk AST nodes, inspect declarations, query types, or produce diagnostics tied to source ranges.

For simple post-emit text edits, start with [Getting Started](./01-getting-started.md). For the four shipped examples, read [Reference Plugins](./10-reference-plugins.md).

## Choosing the Right Level

Use the smallest surface that answers your question:

| Need | Use | Example |
| --- | --- | --- |
| Add a license banner | emitted file text | `@ttsc/banner` |
| Remove `console.log(...)` statements from JS output | parse emitted JS AST | `@ttsc/strip` |
| Rewrite `paths` aliases in emitted JS and declarations | parse emitted files plus load project config/Program | `@ttsc/paths` |
| Report source diagnostics | Program + AST + diagnostics writer | `@ttsc/lint` |
| Generate code from `T` in `foo<T>()` | Program + AST + Checker | semantic transformer plugins |

The AST is not a string parser. Use it when structure matters: statement kind, callee shape, declaration members, type argument syntax, import/export syntax, or diagnostic ranges.

The Checker is not a faster AST. Use it when meaning matters: aliases, inherited properties, resolved symbols, unions, intersections, instantiated generics, or apparent properties.

## Shim Model

TypeScript-Go internals are Go packages, many of them internal. `ttsc` exposes a narrow shim boundary under `github.com/microsoft/typescript-go/shim/...`.

Plugin source imports the shim:

```go
import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
)
```

Your `go.mod` must require every shim package you import:

```text
module my-plugin

go 1.26

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/microsoft/typescript-go/shim/checker v0.0.0
	github.com/microsoft/typescript-go/shim/compiler v0.0.0
)
```

`v0.0.0` is intentional. The modules are supplied by `ttsc`'s generated `go.work` overlay at build time. For local editor support, create your own `go.work`; see [Local Development](./04-local-dev.md).

Useful shim modules:

| Shim | Use |
| --- | --- |
| `shim/ast` | `SourceFile`, `Node`, `Kind*`, typed accessors like `AsCallExpression` |
| `shim/parser` | parse emitted JS or TS text into a `SourceFile` |
| `shim/scanner` | token positions, trivia skipping, line/column mapping, source text helpers |
| `shim/tsoptions` | parse `tsconfig.json` |
| `shim/compiler` | create Program, emit, diagnostics |
| `shim/checker` | query symbols and types |
| `shim/diagnosticwriter` | render compiler-like diagnostics |
| `shim/bundled` | TypeScript lib files for Program creation |

Do not import `github.com/microsoft/typescript-go/internal/...` directly. The shim is the plugin boundary.

## Program Bootstrap

A Program gives you the project graph. A Checker gives you semantic meaning over that graph.

The canonical bootstrap has five steps:

1. Wrap the OS filesystem with `bundled.WrapFS`.
2. Create a compiler host with `bundled.LibPath()`.
3. Parse the consumer's tsconfig with `tsoptions.GetParsedCommandLineOfConfigFile`.
4. Create a `shimcompiler.Program`.
5. Acquire a Checker and defer its release function.

```go
import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/microsoft/typescript-go/shim/bundled"
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	"github.com/microsoft/typescript-go/shim/tsoptions"
	"github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
	"github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

type loadedProgram struct {
	cwd     string
	program *shimcompiler.Program
	checker *shimchecker.Checker
	release func()
}

func loadProgram(cwd, tsconfigPath string) (*loadedProgram, []*shimast.Diagnostic, error) {
	if !filepath.IsAbs(cwd) {
		abs, err := filepath.Abs(cwd)
		if err != nil {
			return nil, nil, err
		}
		cwd = abs
	}
	if !filepath.IsAbs(tsconfigPath) {
		tsconfigPath = filepath.Join(cwd, tsconfigPath)
	}

	fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
	host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)

	parsed, parseDiags := tsoptions.GetParsedCommandLineOfConfigFile(
		tsconfigPath,
		&shimcore.CompilerOptions{},
		nil,
		host,
		nil,
	)
	if parsed == nil {
		return nil, nil, fmt.Errorf("tsconfig parse returned nil for %s", tsconfigPath)
	}
	if len(parseDiags) > 0 {
		return nil, parseDiags, nil
	}
	if len(parsed.Errors) > 0 {
		return nil, parsed.Errors, nil
	}

	program := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
		Config:                      parsed,
		SingleThreaded:              shimcore.TSTrue,
		Host:                        host,
		UseSourceOfProjectReference: true,
	})
	if program == nil {
		return nil, nil, fmt.Errorf("compiler.NewProgram returned nil")
	}

	checker, release := program.GetTypeChecker(context.Background())
	return &loadedProgram{
		cwd:     cwd,
		program: program,
		checker: checker,
		release: release,
	}, nil, nil
}
```

Always call `defer loaded.release()` after a successful load. TypeScript-Go leases checker resources internally.

Reference code:

- [`packages/lint/plugin/host.go`](../packages/lint/plugin/host.go) - production-grade Program loader.
- [`tests/projects/go-source-plugin-checker/go-plugin/main.go`](../tests/projects/go-source-plugin-checker/go-plugin/main.go) - compact bootstrap fixture.

## Finding the Target File

`program.SourceFiles()` returns every file in the Program: user files, declaration files, and library files. Normalize paths before comparing.

```go
func findSourceFile(program *shimcompiler.Program, target string) *shimast.SourceFile {
	want := filepath.ToSlash(target)
	for _, file := range program.SourceFiles() {
		if file == nil {
			continue
		}
		if filepath.ToSlash(file.FileName()) == want {
			return file
		}
	}
	return nil
}
```

For project-wide analysis, filter declaration files:

```go
func userSourceFiles(program *shimcompiler.Program) []*shimast.SourceFile {
	out := []*shimast.SourceFile{}
	for _, file := range program.SourceFiles() {
		if file == nil || file.IsDeclarationFile {
			continue
		}
		out = append(out, file)
	}
	return out
}
```

## AST Basics

The main types are:

- `*shimast.SourceFile`: one parsed file.
- `*shimast.Node`: generic AST node.
- `shimast.Kind`: enum describing the node shape.
- `NodeList`: list wrapper whose `Nodes` field contains child nodes.

Core access pattern:

```go
if node.Kind == shimast.KindCallExpression {
	call := node.AsCallExpression()
	if call != nil {
		// call.Expression, call.Arguments, ...
	}
}
```

Use `Kind` before a typed accessor. Accessors usually return `nil` when the kind does not match.

Important `Node` data:

- `node.Kind`: syntactic kind.
- `node.Pos()`: start offset, often including leading trivia.
- `node.End()`: end offset.
- `node.Parent`: parent node when available.
- `node.Symbol()`: bound symbol for declarations.
- `node.ForEachChild(fn)`: visit child nodes.

Important `SourceFile` data:

- `file.FileName()`: normalized path.
- `file.Text()`: full source text.
- `file.Statements.Nodes`: top-level statements.
- `file.IsDeclarationFile`: true for `.d.ts` / library declarations.
- `file.AsNode()`: use when a rule operates on the `SourceFile` node itself.

## Traversal Pattern

For top-level declarations:

```go
func collectInterfaces(file *shimast.SourceFile) map[string]*shimast.InterfaceDeclaration {
	out := map[string]*shimast.InterfaceDeclaration{}
	if file == nil || file.Statements == nil {
		return out
	}
	for _, stmt := range file.Statements.Nodes {
		if stmt == nil || stmt.Kind != shimast.KindInterfaceDeclaration {
			continue
		}
		decl := stmt.AsInterfaceDeclaration()
		if decl == nil || decl.Name() == nil {
			continue
		}
		out[decl.Name().Text()] = decl
	}
	return out
}
```

For full-tree traversal:

```go
func walk(node *shimast.Node, visit func(*shimast.Node)) {
	if node == nil {
		return
	}
	visit(node)
	node.ForEachChild(func(child *shimast.Node) bool {
		walk(child, visit)
		return false // keep visiting siblings
	})
}

func walkFile(file *shimast.SourceFile, visit func(*shimast.Node)) {
	if file == nil || file.Statements == nil {
		return
	}
	for _, stmt := range file.Statements.Nodes {
		walk(stmt, visit)
	}
}
```

`@ttsc/lint` uses this shape and dispatches rules by `node.Kind`; see [`packages/lint/plugin/engine.go`](../packages/lint/plugin/engine.go).

## Text Ranges and Trivia

`node.Pos()` may include leading whitespace and comments. For diagnostics or source slices, often skip trivia:

```go
func nodeTokenText(file *shimast.SourceFile, node *shimast.Node) string {
	if file == nil || node == nil {
		return ""
	}
	text := file.Text()
	start := shimscanner.SkipTrivia(text, node.Pos())
	end := node.End()
	if start < 0 || start >= end || end > len(text) {
		return ""
	}
	return strings.TrimRight(text[start:end], " \t\r\n")
}
```

For line/column diagnostics:

```go
line, col := shimscanner.GetECMALineAndByteOffsetOfPosition(file, node.Pos())
_ = line
_ = col
```

For token-level diagnostics, prefer:

```go
pos := shimscanner.GetTokenPosOfNode(node, file, false)
```

The lint plugin's helpers are good examples:

- [`packages/lint/plugin/ast_helpers.go`](../packages/lint/plugin/ast_helpers.go)
- `nodeText`
- `identifierText`
- `stripParens`
- `isMatchingPropertyAccess`

## Recognizing Calls

A call expression has a callee in `call.Expression` and arguments in `call.Arguments`.

```go
func callName(expr *shimast.Node) (string, bool) {
	if expr == nil || expr.Kind != shimast.KindCallExpression {
		return "", false
	}
	call := expr.AsCallExpression()
	return dottedName(call.Expression)
}

func dottedName(node *shimast.Node) (string, bool) {
	if node == nil {
		return "", false
	}
	switch node.Kind {
	case shimast.KindIdentifier:
		return node.Text(), true
	case shimast.KindPropertyAccessExpression:
		access := node.AsPropertyAccessExpression()
		left, ok := dottedName(access.Expression)
		if !ok || access.Name() == nil {
			return "", false
		}
		return left + "." + access.Name().Text(), true
	default:
		return "", false
	}
}
```

This recognizes:

- `console.log`
- `assert.equal`
- `foo`

It does not treat `obj["log"]()` or optional chaining as the same shape. Add those cases only when your plugin needs them.

Reference: [`packages/strip/plugin/strip.go`](../packages/strip/plugin/strip.go).

## Recognizing Imports and Module Specifiers

`@ttsc/paths` rewrites specifiers in many syntax forms:

- `import x from "pkg"`
- `export { x } from "pkg"`
- `import x = require("pkg")`
- `type T = import("pkg").T`
- `declare module "pkg"`
- `require("pkg")`
- `await import("pkg")`

The common operation is: find a string literal node, compute the literal text range, replace only that range, and preserve quote style.

```go
func stringLiteralRange(text string, node *shimast.Node) (int, int, byte, bool) {
	start := clamp(node.Pos(), 0, len(text))
	end := clamp(node.End(), start, len(text))
	for start < end && text[start] != '"' && text[start] != '\'' {
		start++
	}
	if start >= end {
		return 0, 0, 0, false
	}
	quote := text[start]
	for end > start+1 && text[end-1] != quote {
		end--
	}
	if end <= start+1 {
		return 0, 0, 0, false
	}
	return start, end, quote, true
}
```

Reference: [`packages/paths/plugin/paths.go`](../packages/paths/plugin/paths.go).

## TypeScript Type Syntax

Type nodes are AST syntax. They tell you what the user wrote, not necessarily what the type means after alias resolution.

Common type-node kinds:

- `KindTypeReference`: `User`, `Array<User>`, `Record<string, User>`
- `KindTypeLiteral`: `{ id: string }`
- `KindInterfaceDeclaration`: `interface User { ... }`
- `KindTypeAliasDeclaration`: `type User = ...`
- `KindUnionType`: `A | B`
- `KindIntersectionType`: `A & B`
- `KindArrayType`: `T[]`
- `KindTupleType`: `[A, B]`
- `KindLiteralType`: `"x"`, `1`, `true`
- `KindFunctionType`: `(x: string) => number`

Lexical interface property extraction:

```go
func propertyNames(decl *shimast.InterfaceDeclaration) []string {
	if decl == nil || decl.Members == nil {
		return nil
	}
	out := []string{}
	for _, member := range decl.Members.Nodes {
		if member == nil || member.Kind != shimast.KindPropertySignature {
			continue
		}
		prop := member.AsPropertySignatureDeclaration()
		if prop == nil || prop.Name() == nil {
			continue
		}
		out = append(out, prop.Name().Text())
	}
	return out
}
```

This only sees properties written directly in that interface body. It does not expand `extends`, intersections, mapped types, or aliases. Use the Checker for that.

Reference: [`tests/projects/go-source-plugin-properties/go-plugin/main.go`](../tests/projects/go-source-plugin-properties/go-plugin/main.go).

## Checker Basics

The Checker answers semantic questions. The shim currently exposes focused helpers, including:

- `Checker_getPropertiesOfType(checker, typ)`
- `Checker_getApparentProperties(checker, typ)`
- `Checker_getTypeOfSymbol(checker, symbol)`
- `Checker_getTypeOfSymbolAtLocation(checker, symbol, node)`
- `Checker_getTypeOfPropertyOfType(checker, typ, name)`
- `Checker_getTypeArguments(checker, typ)`
- `Checker_getIndexInfosOfType(checker, typ)`
- `Checker_resolveEntityName(checker, name, meaning, ignoreErrors, dontResolveAlias, location)`
- `Checker_getAliasedSymbol(checker, symbol)`
- `Checker_isArrayType(checker, typ)`
- `IsTupleType(typ)`
- `Type_getTypeNameSymbol(typ)`

AST-to-Checker flow usually looks like this:

1. Find a node in the AST.
2. Get a symbol from the node or resolve a name through the Checker.
3. Get a `*checker.Type` from the symbol.
4. Query properties, type arguments, flags, or index info.

Example outline:

```go
func apparentPropertyNames(checker *shimchecker.Checker, declNode *shimast.Node) []string {
	if checker == nil || declNode == nil || declNode.Kind != shimast.KindInterfaceDeclaration {
		return nil
	}
	symbol := declNode.Symbol()
	if symbol == nil {
		return nil
	}
	typ := shimchecker.Checker_getTypeOfSymbol(checker, symbol)
	props := shimchecker.Checker_getApparentProperties(checker, typ)

	out := make([]string, 0, len(props))
	for _, prop := range props {
		if prop == nil {
			continue
		}
		out = append(out, prop.Name)
	}
	return out
}
```

Use `GetApparentProperties` for user-facing object shape. It includes more of what developers expect from `extends` and merged declarations than a direct AST member walk.

Current caveat: the shim does not expose a simple `GetTypeFromTypeNode` helper. For a `<T>` type argument you often either:

- inspect the type node syntactically when syntax is enough;
- resolve an entity name with `Checker_resolveEntityName`;
- follow symbols from declarations already in the Program;
- request a shim addition if the plugin needs a missing Checker method.

## Building Diagnostics

For plugin diagnostics, report source ranges that point at the offending token, not the whole statement when possible.

Lint-style flow:

1. Walk user source files.
2. Collect findings as `(file, pos, end, rule, severity, message)`.
3. Convert them to `shim/diagnosticwriter` lint diagnostics.
4. Render them together with TypeScript-Go diagnostics.

Reference files:

- [`packages/lint/plugin/engine.go`](../packages/lint/plugin/engine.go)
- [`packages/lint/plugin/compile.go`](../packages/lint/plugin/compile.go)
- [`packages/ttsc/shim/diagnosticwriter/lint.go`](../packages/ttsc/shim/diagnosticwriter/lint.go)

If your plugin exits non-zero, write clear diagnostics to stderr. `ttsc` surfaces stderr directly.

## Text Edits

Most plugins should not mutate AST nodes. They should compute text edits and apply them to source or output text.

Edit type:

```go
type textEdit struct {
	start int
	end   int
	text  string
}
```

Apply from the end of the file to the start:

```go
func applyTextEdits(text string, edits []textEdit) string {
	sort.SliceStable(edits, func(i, j int) bool {
		if edits[i].start == edits[j].start {
			return edits[i].end > edits[j].end
		}
		return edits[i].start > edits[j].start
	})
	out := text
	for _, edit := range edits {
		if edit.start < 0 || edit.end < edit.start || edit.end > len(out) {
			continue
		}
		out = out[:edit.start] + edit.text + out[edit.end:]
	}
	return out
}
```

Why reverse order: earlier edits do not shift the offsets of later edits that are already applied.

For statement removal, include indentation and trailing newline when that is safe. `@ttsc/strip` shows a practical statement range function.

## Parsing Emitted JS Without a Program

Output plugins can parse a single emitted JS file:

```go
func parseJS(fileName, text string) *shimast.SourceFile {
	opts := shimast.SourceFileParseOptions{
		FileName: filepath.ToSlash(fileName),
	}
	return shimparser.ParseSourceFile(opts, text, shimcore.ScriptKindJS)
}
```

Use this when the emitted file contains all information needed for the edit. `@ttsc/strip` is the model.

Use a Program when you need project-level facts, such as `compilerOptions.paths`, source file membership, declaration emit mapping, or semantic types. `@ttsc/paths` and `@ttsc/lint` are the models.

## Common AST Mistakes

- Comparing raw paths without `filepath.ToSlash`.
- Slicing `file.Text()[node.Pos():node.End()]` and accidentally including comments/whitespace.
- Calling `AsX()` and assuming it cannot be nil.
- Walking declaration files when you meant user code.
- Treating a type node as a resolved type.
- Editing text from the start of the file toward the end.
- Reporting diagnostics at statement start instead of token start.
- Trying to use Checker data before acquiring and deferring the release callback.

## Study Path

Read these in order:

1. [`packages/banner`](../packages/banner/) - output pass with no AST.
2. [`packages/strip/plugin/strip.go`](../packages/strip/plugin/strip.go) - parse emitted JS, walk AST, edit text.
3. [`packages/paths/plugin/paths.go`](../packages/paths/plugin/paths.go) - parse tsconfig, load Program, rewrite specifiers.
4. [`tests/projects/go-source-plugin-checker`](../tests/projects/go-source-plugin-checker/) - Program/Checker bootstrap.
5. [`tests/projects/go-source-plugin-properties`](../tests/projects/go-source-plugin-properties/) - declaration AST walk.
6. [`packages/lint/plugin`](../packages/lint/plugin/) - full diagnostics engine.
