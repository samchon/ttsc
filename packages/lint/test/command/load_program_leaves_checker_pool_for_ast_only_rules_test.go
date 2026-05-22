package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadProgramLeavesCheckerPoolForAstOnlyRules verifies AST-only lint does
// not pin TypeScript-Go's checker pool.
//
// Vue and type-fest benchmark configs enable only AST rules. Clamping their
// programs to one checker serializes semantic diagnostics even though no rule
// receives Context.Checker, so loadProgram should preserve the requested
// checker count until a type-aware rule asks for the checker.
//
// 1. Materialize a tiny TypeScript project.
// 2. loadProgram with checkers=8 and needsRuleChecker=false.
// 3. Assert Checkers remains 8 and no rule checker was acquired.
func TestLoadProgramLeavesCheckerPoolForAstOnlyRules(t *testing.T) {
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
    t.Fatal("AST-only load acquired a rule checker")
  }
  if prog.releaseChecker != nil {
    t.Fatal("AST-only load installed a checker release callback")
  }
}
