package linthost

import (
  "context"
  "path/filepath"
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
)

// TestLoadProgramKeepsCheckerPoolForTypeAwareRules verifies a type-aware lint
// run preserves the Program's requested checker pool and owns a separate
// checker for rule queries.
//
// Borrowing the Program pool's first checker would mix its type graph with AST
// nodes assigned to other pool members. Pinning the whole pool to one avoids
// that correctness bug but serializes semantic diagnostics. A standalone lint
// checker keeps every rule query in one type graph without changing the
// diagnostic pool.
//
//  1. Load a multi-file project with four Program checkers and a rule checker.
//  2. Assert the configured pool size remains four.
//  3. Assert the lint checker is not the Program pool's first checker.
//  4. Assert single-threaded mode still takes precedence over the pool size.
func TestLoadProgramKeepsCheckerPoolForTypeAwareRules(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/a.ts", "src/b.ts", "src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "a.ts"), "export const a = 1;\n")
  writeFile(t, filepath.Join(root, "src", "b.ts"), "export const b = 2;\n")
  writeFile(t, filepath.Join(root, "src", "main.ts"),
    "import { a } from \"./a\";\nimport { b } from \"./b\";\nexport const sum = a + b;\n")

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    checkers:         4,
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()

  checkers := prog.parsed.ParsedConfig.CompilerOptions.Checkers
  if checkers == nil {
    t.Fatal("Checkers is nil; expected the requested checker count to remain visible")
  }
  if *checkers != 4 {
    t.Fatalf("Checkers = %d, want 4", *checkers)
  }
  if prog.checker == nil {
    t.Fatal("type-aware load did not create a standalone lint checker")
  }

  pooled, release := prog.tsProgram.GetTypeChecker(context.Background())
  defer release()
  if pooled == nil {
    t.Fatal("Program.GetTypeChecker returned nil")
  }
  if pooled == prog.checker {
    t.Fatal("lint checker was borrowed from the Program checker pool")
  }

  prog.close()
  if prog.checker != nil {
    t.Fatal("program.close retained the standalone lint checker")
  }

  single, singleDiags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    checkers:         4,
    needsRuleChecker: true,
    singleThreaded:   true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(singleDiags) != 0 {
    t.Fatalf("unexpected single-threaded diagnostics: %#v", singleDiags)
  }
  defer single.close()
  if single.parsed.ParsedConfig.CompilerOptions.SingleThreaded != shimcore.TSTrue {
    t.Fatal("type-aware load did not preserve --singleThreaded")
  }
  if single.checker == nil {
    t.Fatal("single-threaded type-aware load did not create a standalone lint checker")
  }
}
