package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadProgramSkipsCheckerForAstOnlyRules verifies AST-only lint preserves
// the Program's requested checker pool without creating a lint checker.
//
// A syntactic rule never reads Context.Checker, so constructing a standalone
// checker and forcing the engine onto its serial walk would be wasted work.
// The Program pool remains independent and keeps the caller's configured size.
//
//  1. Materialize a tiny TypeScript project.
//  2. Load it with eight Program checkers and no rule checker request.
//  3. Assert the pool stays at eight and no lint checker was created.
func TestLoadProgramSkipsCheckerForAstOnlyRules(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export const value = 1;\n")

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    checkers: 8,
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
  if *checkers != 8 {
    t.Fatalf("Checkers = %d, want 8", *checkers)
  }
  if prog.checker != nil {
    t.Fatal("AST-only load created a standalone lint checker")
  }
}
