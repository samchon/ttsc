package graph

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestResolveUnwrapsBarrelReexportToRealDeclaration is a traversal-completeness
// probe, not a unit test of a single branch: it runs a real Checker over a
// ttsc-owned fixture and asserts the load-bearing graph primitive
// (GetSymbolAtLocation -> Checker_getAliasedSymbol -> declaration) reaches the
// sibling source that actually declares a symbol, instead of dead-ending on the
// barrel re-export. This is the differentiator the whole package rests on: a
// path-heuristic tool stops at the index file and severs every cross-package
// edge, so if this surface ever regresses the graph silently collapses back to
// tree-sitter quality. Mirrors the naive-vs-bridged shape of the base-chain
// probe in packages/lint/test/shim.
//
//  1. Compile a fixture where main.ts imports `target` through a barrel
//     (`index.ts` re-exports it from `impl.ts`).
//  2. Resolve the call-site reference two ways: the naive `GetSymbolAtLocation`
//     stop (the local import alias) and the bridged `Resolve` (alias unwrapped).
//  3. Assert the naive stop lands on the import in main.ts (the edge is severed
//     there) while `Resolve` lands on the real declaration in impl.ts, and that
//     a workspace declaration is not classified as an external boundary leaf.
func TestResolveUnwrapsBarrelReexportToRealDeclaration(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "impl.ts"), `export function target(): number {
  return 1;
}
`)
  // The barrel: re-exports the sibling's symbol without redeclaring it. This is
  // the alias hop that severs the edge for a path-string resolver.
  writeFile(t, filepath.Join(root, "src", "index.ts"), `export { target } from "./impl";
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { target } from "./index";
const value = 1;
const echoed = value;
target();
void echoed;
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  checker := prog.Checker
  if checker == nil {
    t.Fatal("LoadProgram did not acquire a checker")
  }
  main := sourceFile(t, prog, "main.ts")

  // The naive stop: GetSymbolAtLocation alone binds the call-site reference to
  // the LOCAL import alias, whose declaration is the import specifier in main.ts.
  // A resolver that stops here severs the edge at the import and never reaches
  // the package that declares target.
  callee := calleeIdentifier(t, main)
  raw := checker.GetSymbolAtLocation(callee)
  if raw == nil {
    t.Fatal("GetSymbolAtLocation returned nil for the call-site reference")
  }
  if raw.Flags&shimast.SymbolFlagsAlias == 0 {
    t.Fatal("premise broken: the call-site reference is not an alias, so there is no barrel hop to unwrap")
  }
  if rawFile := declarationFile(raw); rawFile == nil || !strings.HasSuffix(rawFile.FileName(), "main.ts") {
    t.Fatalf("naive stop did not land on the import in main.ts: %v", raw.Declarations)
  }

  // The bridged walk: Resolve unwraps the alias chain to the real declaration.
  resolved := Resolve(checker, callee)
  if resolved == nil {
    t.Fatal("Resolve returned nil for the call-site reference")
  }
  if resolved.Symbol == nil || resolved.Symbol.Name != "target" {
    t.Fatalf("Resolve did not land on the target symbol: %+v", resolved.Symbol)
  }
  if !strings.HasSuffix(resolved.File, "impl.ts") {
    t.Fatalf("Resolve dead-ended before impl.ts: got %q (a barrel-severed resolver would report index.ts)", resolved.File)
  }
  if strings.HasSuffix(resolved.File, "index.ts") {
    t.Fatalf("Resolve stopped at the re-exporting barrel index.ts instead of the declaration")
  }
  if resolved.External {
    t.Fatalf("a workspace declaration (%q) was misclassified as an external boundary leaf", resolved.File)
  }

  // A directly-declared local reference skips the alias unwrap and is a
  // workspace node, not an external leaf.
  local := Resolve(checker, identifier(t, main, "value"))
  if local == nil || local.Symbol == nil || local.Symbol.Name != "value" {
    t.Fatalf("Resolve did not bind the local const reference: %+v", local)
  }
  if !strings.HasSuffix(local.File, "main.ts") || local.External {
    t.Fatalf("local const resolved to the wrong place: %+v", local)
  }

  // A node the checker cannot bind to a symbol resolves to nil rather than
  // panicking, so the extraction walk can skip it.
  if got := Resolve(checker, numericLiteral(t, main)); got != nil {
    t.Fatalf("Resolve bound a numeric literal to a symbol: %+v", got)
  }
}

// sourceFile returns the resident program's source file whose path ends with
// suffix, failing the test when no such file is loaded.
func sourceFile(t *testing.T, prog *driver.Program, suffix string) *shimast.SourceFile {
  t.Helper()
  for _, file := range prog.SourceFiles() {
    if strings.HasSuffix(file.FileName(), suffix) {
      return file
    }
  }
  t.Fatalf("source file %q not found in program", suffix)
  return nil
}

// calleeIdentifier returns the expression identifier of the first call
// expression in file (the `target` in `target()`), failing when absent.
func calleeIdentifier(t *testing.T, file *shimast.SourceFile) *shimast.Node {
  t.Helper()
  var found *shimast.Node
  walkNodes(file, func(node *shimast.Node) bool {
    if node.Kind == shimast.KindCallExpression {
      if call := node.AsCallExpression(); call != nil {
        found = call.Expression
        return true
      }
    }
    return false
  })
  if found == nil {
    t.Fatal("could not locate a call-site identifier in the fixture")
  }
  return found
}

// identifier returns the first identifier node in file whose text is name,
// failing when absent.
func identifier(t *testing.T, file *shimast.SourceFile, name string) *shimast.Node {
  t.Helper()
  var found *shimast.Node
  walkNodes(file, func(node *shimast.Node) bool {
    if node.Kind == shimast.KindIdentifier && shimast.NodeText(node) == name {
      found = node
      return true
    }
    return false
  })
  if found == nil {
    t.Fatalf("identifier %q not found in the fixture", name)
  }
  return found
}

// numericLiteral returns the first numeric literal node in file, failing when
// absent.
func numericLiteral(t *testing.T, file *shimast.SourceFile) *shimast.Node {
  t.Helper()
  var found *shimast.Node
  walkNodes(file, func(node *shimast.Node) bool {
    if node.Kind == shimast.KindNumericLiteral {
      found = node
      return true
    }
    return false
  })
  if found == nil {
    t.Fatal("numeric literal not found in the fixture")
  }
  return found
}

// walkNodes performs a pre-order walk of file's statement subtrees, calling
// visit on each node and stopping the whole walk as soon as visit returns true.
func walkNodes(file *shimast.SourceFile, visit func(*shimast.Node) bool) {
  if file.Statements == nil {
    return
  }
  var recur func(node *shimast.Node) bool
  recur = func(node *shimast.Node) bool {
    if node == nil {
      return false
    }
    if visit(node) {
      return true
    }
    return node.ForEachChild(func(child *shimast.Node) bool {
      return recur(child)
    })
  }
  for _, stmt := range file.Statements.Nodes {
    if recur(stmt) {
      return
    }
  }
}

// writeFile writes content to path, creating parent directories, failing the
// test on any error.
func writeFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}
