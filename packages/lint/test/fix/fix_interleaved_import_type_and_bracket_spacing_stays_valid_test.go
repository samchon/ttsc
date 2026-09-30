package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestFixInterleavedImportTypeAndBracketSpacingStaysValid verifies two rules
// whose fixes interleave never emit invalid code through the shared disk
// applier.
//
// samchon/ttsc#605: `no-import-type-side-effects` emits an atomic pair (insert
// `type ` at the clause + delete the inline `type ` before the specifier), and
// `format/bracket-spacing` replaces the WHOLE brace interior — which contains
// that inline `type`. The old flat applier kept the insert but dropped the
// paired delete when it collided with the interior replace, producing the
// TS2206-invalid `import type { type A }`. With per-finding-atomic selection one
// finding wins the contested range wholly, so every intermediate and final
// state is valid TypeScript.
//
//  1. Seed a project importing `{  type A }` from a resolvable module.
//  2. Cascade both rules on disk exactly like `ttsc fix`.
//  3. Assert no pass ever writes the half-applied `import type { type A }`.
//  4. Assert the cascade converges to `import type { A } from "./m";`.
//
// @evidence contracts/testing.md#behavioral-verification The real Program/fix cascade resolves overlapping import-type and bracket-spacing findings atomically and converges to import type { A }.
// @evidence contracts/testing.md#independent-expectations Every pass rejects the literal half-applied type/type forms; the independently authored final source preserves the x declaration and JSON.stringify call.
// @evidence contracts/testing.md#distinguishing-cases Two conflicting multi-edit intentions must converge without an invalid intermediate import; maxFixPasses bounds the nonconverging failure.
// @evidence contracts/testing.md#execution-ownership TestFixInterleavedImportTypeAndBracketSpacingStaysValid owns every cascade pass through loadProgram, program.runLintCycle and applyFindingFixes in one Go process.
func TestFixInterleavedImportTypeAndBracketSpacingStaysValid(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts", "src/m.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "m.ts"), "export interface A {}\n")
  mainPath := filepath.Join(root, "src", "main.ts")
  source := "import {  type A } from \"./m\";\nconst x: A | null = null;\nJSON.stringify(x);\n"
  writeFile(t, mainPath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{
      "typescript/no-import-type-side-effects": SeverityError,
      "format/bracket-spacing":                 SeverityError,
    },
    Options: RuleOptionsMap{
      "format/bracket-spacing": json.RawMessage(`{"spacing":true}`),
    },
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("config error: %v", err)
  }
  needsChecker := engine.NeedsTypeChecker()

  converged := false
  for pass := 0; pass < maxFixPasses; pass++ {
    prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
      forceNoEmit:      true,
      needsRuleChecker: needsChecker,
    })
    if err != nil {
      t.Fatalf("pass %d loadProgram: %v", pass, err)
    }
    if len(diags) != 0 {
      prog.close()
      t.Fatalf("pass %d loadProgram diagnostics: %+v", pass, diags)
    }
    findings := prog.runLintCycle(engine)
    fixed, err := applyFindingFixes(root, findings)
    prog.close()
    if err != nil {
      t.Fatalf("pass %d applyFindingFixes: %v", pass, err)
    }
    got, err := os.ReadFile(mainPath)
    if err != nil {
      t.Fatalf("pass %d read main.ts: %v", pass, err)
    }
    for _, invalid := range []string{"import type { type", "import type {  type"} {
      if strings.Contains(string(got), invalid) {
        t.Fatalf("pass %d produced half-applied invalid import %q:\n%s", pass, invalid, got)
      }
    }
    if fixed == 0 {
      converged = true
      break
    }
  }
  if !converged {
    t.Fatalf("cascade did not converge within %d passes", maxFixPasses)
  }

  got, err := os.ReadFile(mainPath)
  if err != nil {
    t.Fatalf("read main.ts: %v", err)
  }
  want := "import type { A } from \"./m\";\nconst x: A | null = null;\nJSON.stringify(x);\n"
  if string(got) != want {
    t.Fatalf("cascade result mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
