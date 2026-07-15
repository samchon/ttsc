package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestStandaloneCheckerResolvesCrossFileTypeAfterPooledDiagnostics verifies
// the new checker shim is a runtime-complete path for lint type queries.
//
// Linkage alone does not prove that a standalone checker can traverse types
// after the Program's file-affinity pool has checked the same AST. This probe
// resolves a generic declaration from another file only through the dedicated
// lint checker and pins the resulting type, while the Program pool remains at
// four checkers.
//
//  1. Build a two-file project whose imported value has a generic string field.
//  2. Run pooled semantic diagnostics, then find the cross-file property read.
//  3. Resolve it through the standalone lint checker and assert `string`.
func TestStandaloneCheckerResolvesCrossFileTypeAfterPooledDiagnostics(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/model.ts", "src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "model.ts"), `export interface Box<T> {
  value: T;
}
export declare const box: Box<string>;
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { box } from "./model";
export const result = box.value;
`)

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    checkers:         4,
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %#v", diags)
  }
  defer prog.close()

  if diagnostics := prog.programDiagnostics(); len(diagnostics) != 0 {
    t.Fatalf("unexpected program diagnostics: %#v", diagnostics)
  }
  mainFile := prog.findSourceFile(filepath.Join(root, "src", "main.ts"))
  if mainFile == nil {
    t.Fatal("main.ts was not loaded into the Program")
  }
  var access *shimast.Node
  walkDescendants(mainFile.AsNode(), func(node *shimast.Node) {
    if node.Kind == shimast.KindPropertyAccessExpression && nodeText(mainFile, node) == "box.value" {
      access = node
    }
  })
  if access == nil {
    t.Fatal("cross-file property access box.value was not found")
  }

  resolved := prog.checker.GetTypeAtLocation(access)
  if resolved == nil {
    t.Fatal("standalone lint checker returned nil for box.value")
  }
  if got := prog.checker.TypeToString(resolved); got != "string" {
    t.Fatalf("standalone lint checker resolved box.value as %q, want string", got)
  }
}
