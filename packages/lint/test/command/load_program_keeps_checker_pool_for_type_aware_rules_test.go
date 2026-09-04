package linthost

import (
  "context"
  "fmt"
  "path/filepath"
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// TestLoadProgramKeepsCheckerPoolForTypeAwareRules verifies loadProgram's
// checker-pool and generated-wrapper ownership contracts in one bootstrap.
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
//  5. Restore a generated wrapper's explicit semantic config owner.
//  6. Carry that owner from an LSP invocation through cold and resident loads.
//  7. Prove ambient-only and relative owner values cannot affect later loads.
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

  generatedRoot := t.TempDir()
  semanticConfig := filepath.Join(root, "tsconfig.json")
  generatedConfig := filepath.Join(generatedRoot, "tsconfig.json")
  writeFile(t, generatedConfig, fmt.Sprintf(`{"extends":%q}`, filepath.ToSlash(semanticConfig)))
  t.Setenv(semanticConfigPathEnv, semanticConfig)
  generated, generatedDiags, err := loadProgram(root, generatedConfig, loadProgramOptions{
    forceNoEmit:        true,
    semanticConfigPath: semanticConfig,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(generatedDiags) != 0 {
    t.Fatalf("unexpected generated-wrapper diagnostics: %#v", generatedDiags)
  }
  defer generated.close()
  if got := generated.tsProgram.Options().ConfigFilePath; got != shimtspath.ResolvePath(semanticConfig) {
    t.Fatalf("generated wrapper semantic config = %q, want %q", got, shimtspath.ResolvePath(semanticConfig))
  }

  lspOptions, ok := parseLSPCommandOptions("lsp-diagnostics", []string{
    "--cwd", root,
    "--tsconfig", generatedConfig,
  })
  if !ok {
    t.Fatal("parseLSPCommandOptions rejected generated wrapper invocation")
  }
  coldLSP, coldLSPDiags, closeColdLSP, err := acquireProgram(lspOptions, false)
  if closeColdLSP != nil {
    defer closeColdLSP()
  }
  if err != nil {
    t.Fatal(err)
  }
  if len(coldLSPDiags) != 0 {
    t.Fatalf("unexpected cold LSP diagnostics: %#v", coldLSPDiags)
  }
  if got := coldLSP.tsProgram.Options().ConfigFilePath; got != shimtspath.ResolvePath(semanticConfig) {
    t.Fatalf("cold LSP semantic config = %q, want %q", got, shimtspath.ResolvePath(semanticConfig))
  }

  resident := newResidentProgramCache()
  residentLSP, residentLSPDiags, _, err := resident.acquire(lspOptions, false)
  if err != nil {
    t.Fatal(err)
  }
  if len(residentLSPDiags) != 0 {
    t.Fatalf("unexpected resident LSP diagnostics: %#v", residentLSPDiags)
  }
  if got := residentLSP.tsProgram.Options().ConfigFilePath; got != shimtspath.ResolvePath(semanticConfig) {
    t.Fatalf("resident LSP semantic config = %q, want %q", got, shimtspath.ResolvePath(semanticConfig))
  }
  resident.invalidate()

  unmarked, unmarkedDiags, err := loadProgram(root, generatedConfig, loadProgramOptions{forceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(unmarkedDiags) != 0 {
    t.Fatalf("unexpected unmarked-wrapper diagnostics: %#v", unmarkedDiags)
  }
  defer unmarked.close()
  if got := unmarked.tsProgram.Options().ConfigFilePath; got != shimtspath.ResolvePath(generatedConfig) {
    t.Fatalf("unmarked wrapper inherited ambient semantic config = %q, want %q", got, shimtspath.ResolvePath(generatedConfig))
  }
  invalid, _, err := loadProgram(root, generatedConfig, loadProgramOptions{semanticConfigPath: "relative.json"})
  if invalid != nil {
    defer invalid.close()
  }
  if err == nil {
    t.Fatal("relative semantic config path was accepted")
  }
}
