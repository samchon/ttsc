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
//  3. Assert the configured count stays at eight and no lint checker was created.
//
// @evidence contracts/testing.md#behavioral-verification Actual AST-only compiler loading retains configured Checkers=8 while the separate lint checker stays nil and parse diagnostics stay empty; the test observes the option rather than claiming eight runtime pool objects.
// @evidence contracts/testing.md#independent-expectations The authored strict CommonJS source project and literal count eight specify expected configuration independently of the produced Program; nil standalone checker is the resource-ownership oracle.
// @evidence contracts/testing.md#distinguishing-cases A requested Program checker count without needsRuleChecker contrasts with the type-aware counterpart that requires a distinct standalone checker, rejecting unconditional lint checker construction.
// @evidence contracts/testing.md#execution-ownership Direct in-process loadProgram and supported compiler APIs read temporary JSON/TypeScript fixtures and release the Program via deferred close; no Node evaluator, native producer, installation or compiler subprocess runs.
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
