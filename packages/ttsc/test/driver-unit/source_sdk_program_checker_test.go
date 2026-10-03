package driver_test

import (
  "context"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/bundled"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// TestSourceSDKProgramChecker resolves the consumer's User and string[] type
// arguments through an actual public compiler/checker graph.
//
// Printing these names through a regex cannot prove checker semantics. This
// case pins both the resolved types of its source calls and their exact
// source-file ownership instead.
//
//  1. Parse a consumer config containing the original calls and an excluded file.
//  2. Create a Program, lease its checker, and locate the exact consumer source.
//  3. Resolve both type arguments and reject a source absent from the config.
// @evidence contracts/testing.md#behavioral-verification NewCompilerHost, GetParsedCommandLineOfConfigFile, NewProgram, SourceFiles and GetTypeChecker must produce the configured consumer source and resolve its __typeText<User>() and __typeText<string[]>() arguments as User and string[]; a nil checker, altered source or included excluded/main.ts fails.
// @evidence contracts/testing.md#independent-expectations The authored interface and array type arguments independently specify literal User and string[] results; exact consumer text and an independently written excluded/main.ts establish source selection. No fixture regex manufactures the expected type names.
// @evidence contracts/testing.md#distinguishing-cases Two distinct types, the same-basename excluded source outside files, and the exact normalized src/main.ts path distinguish a wrong graph or source lookup. The checker lease is released by cleanup even when an assertion fails.
// @evidence contracts/testing.md#execution-ownership This named Go entry and its private sourceSDKProgram helper exercise public shim operations in the single driver-unit process over temporary compiler inputs; no consumer installation, native plugin build or product host is started. Canonical source-plugin runtime E2E owns module-overlay linkage and host/build transport.
func TestSourceSDKProgramChecker(t *testing.T) {
  source := "interface User {\n  id: number;\n  email: string;\n}\n\nexport const userTypeName: string = __typeText<User>();\nexport const arrayTypeName: string = __typeText<string[]>();\nconsole.log(userTypeName, arrayTypeName);\n"
  program, checker, root := sourceSDKProgram(t, source)
  var main *shimast.SourceFile
  for _, file := range program.SourceFiles() {
    if filepath.ToSlash(file.FileName()) == filepath.ToSlash(filepath.Join(root, "excluded", "main.ts")) {
      t.Fatal("a source excluded by the consumer config entered the Program")
    }
    if filepath.ToSlash(file.FileName()) == filepath.ToSlash(filepath.Join(root, "src", "main.ts")) {
      main = file
    }
  }
  if main == nil { t.Fatal("consumer src/main.ts absent from SourceFiles") }
  if main.Text() != source { t.Fatalf("consumer source changed: %q", main.Text()) }
  resolved := map[string]string{}
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil { return }
    if node.Kind == shimast.KindVariableDeclaration {
      declaration := node.AsVariableDeclaration()
      if declaration.Initializer != nil && declaration.Initializer.Kind == shimast.KindCallExpression {
        call := declaration.Initializer.AsCallExpression()
        if call.TypeArguments != nil && len(call.TypeArguments.Nodes) == 1 {
          typ := checker.GetTypeAtLocation(call.TypeArguments.Nodes[0])
          if typ == nil { t.Fatal("type argument did not resolve") }
          resolved[declaration.Name().Text()] = checker.TypeToString(typ)
        }
      }
    }
    node.ForEachChild(func(child *shimast.Node) bool { walk(child); return false })
  }
  walk(main.AsNode())
  if len(resolved) != 2 || resolved["userTypeName"] != "User" || resolved["arrayTypeName"] != "string[]" {
    t.Fatalf("resolved consumer type arguments: %#v; want userTypeName=User, arrayTypeName=string[]", resolved)
  }
}

// sourceSDKProgram owns the temporary consumer inputs and checker lease for
// the SDK probes. Its files are compiler inputs rather than repository checks.
func sourceSDKProgram(t *testing.T, source string) (*shimcompiler.Program, *shimchecker.Checker, string) {
  t.Helper()
  root := t.TempDir()
  write := func(name, text string) {
    t.Helper()
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil { t.Fatal(err) }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil { t.Fatal(err) }
  }
  write("tsconfig.json", `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"outDir":"dist","rootDir":"src"},"files":["src/main.ts","src/functions.d.ts"]}`)
  write("src/main.ts", source)
  write("src/functions.d.ts", "declare function __typeText<T>(): string;\ndeclare function typeProperties<T>(): readonly string[];\n")
  write("excluded/main.ts", "export const shouldNotBeLoaded = 1;\n")
  fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
  host := shimcompiler.NewCompilerHost(root, fs, bundled.LibPath(), nil, nil)
  parsed, _ := tsoptions.GetParsedCommandLineOfConfigFile(filepath.Join(root, "tsconfig.json"), &core.CompilerOptions{}, nil, host, nil)
  if parsed == nil || len(parsed.Errors) != 0 { t.Fatalf("consumer config parse failed: %#v", parsed) }
  program := shimcompiler.NewProgram(shimcompiler.ProgramOptions{Config: parsed, SingleThreaded: core.TSTrue, Host: host, UseSourceOfProjectReference: true})
  if program == nil { t.Fatal("NewProgram returned nil") }
  checker, release := program.GetTypeChecker(context.Background())
  t.Cleanup(release)
  if checker == nil { t.Fatal("GetTypeChecker returned nil") }
  return program, checker, root
}
