package driver_test

import (
  "path/filepath"
  "reflect"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverPooledBatchPreservesCrossFileCircularAliasAndTransformGraph verifies
// that a one-shot no-emit load under TTSC_BATCH=1 resolves cross-file circular
// indexed-access aliases through prog.Checker to the exact same types as a
// pinned single-checker load, never yielding any, and produces the same
// TransformGraph.
//
//  1. Build an eight-file project where type A in f1.ts indexes into B in f4.ts
//     and B indexes back into A, with six sibling files so four checkers split
//     the compilation.
//  2. Load pinned (without TTSC_BATCH), run Diagnostics, and record the declared
//     type strings of A, AResolved, B, BResolved plus NewTransformGraph.
//  3. Load under TTSC_BATCH=1 with ForceNoEmit, run Diagnostics, and assert
//     every declared type string matches the pinned load, never yields any, and
//     NewTransformGraph matches the pinned graph.
//
// @evidence contracts/testing.md#behavioral-verification Exercises real LoadProgram, Diagnostics, prog.Checker type resolution and NewTransformGraph on an eight-file project with cross-file circular indexed-access aliases in both pinned and TTSC_BATCH=1 ForceNoEmit loads.
// @evidence contracts/testing.md#independent-expectations The authored aliases fix AResolved and BResolved as the literal type "alpha" and forbid any; comparing against the pinned single-checker load independently pins both full alias representations and the TransformGraph.
// @evidence contracts/testing.md#distinguishing-cases Circular indexed-access aliases span f1.ts and f4.ts across six independent sibling files so a four-checker pool splits the files while prog.Checker resolves declarations from both files after pooled Diagnostics.
// @evidence contracts/testing.md#execution-ownership Discoverable Go unit in package driver_test using in-process LoadProgram, Checker and NewTransformGraph over a temporary project; no native binary or consumer install runs.
func TestDriverPooledBatchPreservesCrossFileCircularAliasAndTransformGraph(t *testing.T) {
  root := writeCrossFileCircularAliasProject(t)

  t.Setenv(shimcompiler.BatchEnv, "")
  pinned, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    t.Fatalf("pinned LoadProgram: %v", err)
  }
  if len(diags) != 0 {
    t.Fatalf("pinned config diagnostics: %#v", diags)
  }
  defer pinned.Close()

  if gotDiags := pinned.Diagnostics(); len(gotDiags) != 0 {
    t.Fatalf("pinned Diagnostics: %#v", gotDiags)
  }
  pinnedTypes := readCircularAliasTypes(t, pinned, root)
  pinnedGraph := driver.NewTransformGraph(pinned, root)

  t.Setenv(shimcompiler.BatchEnv, "1")
  pooled, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    t.Fatalf("batch LoadProgram: %v", err)
  }
  if len(diags) != 0 {
    t.Fatalf("batch config diagnostics: %#v", diags)
  }
  defer pooled.Close()

  if gotDiags := pooled.Diagnostics(); len(gotDiags) != 0 {
    t.Fatalf("batch Diagnostics: %#v", gotDiags)
  }
  pooledTypes := readCircularAliasTypes(t, pooled, root)
  pooledGraph := driver.NewTransformGraph(pooled, root)

  for _, name := range []string{"A", "AResolved", "B", "BResolved"} {
    pinnedText := pinnedTypes[name]
    pooledText := pooledTypes[name]
    if pooledText == "" || pooledText == "any" || strings.Contains(pooledText, ": any") {
      t.Fatalf("alias %s resolved to %q on batch load; must never yield any", name, pooledText)
    }
    if pooledText != pinnedText {
      t.Fatalf("alias %s type mismatch: batch=%q pinned=%q", name, pooledText, pinnedText)
    }
  }
  if pooledTypes["AResolved"] != `"alpha"` {
    t.Fatalf("AResolved = %q, want %q", pooledTypes["AResolved"], `"alpha"`)
  }
  if pooledTypes["BResolved"] != `"alpha"` {
    t.Fatalf("BResolved = %q, want %q", pooledTypes["BResolved"], `"alpha"`)
  }
  if !reflect.DeepEqual(pooledGraph, pinnedGraph) {
    t.Fatalf("NewTransformGraph mismatch:\nbatch:  %+v\npinned: %+v", pooledGraph, pinnedGraph)
  }
}

func writeCrossFileCircularAliasProject(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "strict": true,
    "types": [],
    "outDir": "dist"
  },
  "files": [
    "src/f1.ts",
    "src/f2.ts",
    "src/f3.ts",
    "src/f4.ts",
    "src/f5.ts",
    "src/f6.ts",
    "src/f7.ts",
    "src/f8.ts"
  ]
}
`)
  writeProjectFile(t, root, "src/f1.ts", `import type { B } from "./f4";

export type A = {
  next: B["value"];
  tag: "alpha";
};
export type AResolved = A["next"];
`)
  writeProjectFile(t, root, "src/f2.ts", `export interface Pad2 { id: number; label: string; }
export const pad2: Pad2 = { id: 2, label: "two" };
`)
  writeProjectFile(t, root, "src/f3.ts", `export interface Pad3 { id: number; label: string; }
export const pad3: Pad3 = { id: 3, label: "three" };
`)
  writeProjectFile(t, root, "src/f4.ts", `import type { A } from "./f1";

export type B = {
  value: A["tag"];
  count: number;
};
export type BResolved = B["value"];
`)
  writeProjectFile(t, root, "src/f5.ts", `export interface Pad5 { id: number; label: string; }
export const pad5: Pad5 = { id: 5, label: "five" };
`)
  writeProjectFile(t, root, "src/f6.ts", `export interface Pad6 { id: number; label: string; }
export const pad6: Pad6 = { id: 6, label: "six" };
`)
  writeProjectFile(t, root, "src/f7.ts", `export interface Pad7 { id: number; label: string; }
export const pad7: Pad7 = { id: 7, label: "seven" };
`)
  writeProjectFile(t, root, "src/f8.ts", `export interface Pad8 { id: number; label: string; }
export const pad8: Pad8 = { id: 8, label: "eight" };
`)
  return root
}

func readCircularAliasTypes(t *testing.T, prog *driver.Program, root string) map[string]string {
  t.Helper()
  targets := []struct {
    file string
    name string
  }{
    {"src/f1.ts", "A"},
    {"src/f1.ts", "AResolved"},
    {"src/f4.ts", "B"},
    {"src/f4.ts", "BResolved"},
  }
  out := make(map[string]string, len(targets))
  for _, target := range targets {
    sf := prog.SourceFile(filepath.Join(root, filepath.FromSlash(target.file)))
    if sf == nil {
      t.Fatalf("SourceFile(%s) returned nil", target.file)
    }
    decl := findTypeAliasDeclaration(sf, target.name)
    if decl == nil {
      t.Fatalf("type alias %s not found in %s", target.name, target.file)
    }
    sym := prog.Checker.GetSymbolAtLocation(decl.Name())
    if sym == nil {
      t.Fatalf("GetSymbolAtLocation(%s) returned nil", target.name)
    }
    typ := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.Checker, sym)
    if typ == nil {
      t.Fatalf("Checker_getDeclaredTypeOfSymbol(%s) returned nil", target.name)
    }
    out[target.name] = prog.Checker.TypeToString(typ)
  }
  return out
}

func findTypeAliasDeclaration(sf *shimast.SourceFile, name string) *shimast.TypeAliasDeclaration {
  var found *shimast.TypeAliasDeclaration
  var visit func(*shimast.Node)
  visit = func(node *shimast.Node) {
    if node == nil || found != nil {
      return
    }
    if node.Kind == shimast.KindTypeAliasDeclaration {
      alias := node.AsTypeAliasDeclaration()
      if alias != nil && alias.Name() != nil && alias.Name().Text() == name {
        found = alias
        return
      }
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      visit(child)
      return false
    })
  }
  visit(sf.AsNode())
  return found
}
