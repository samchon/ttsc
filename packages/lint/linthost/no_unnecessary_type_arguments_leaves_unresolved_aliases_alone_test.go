package linthost

import (
  "path/filepath"
  "testing"
)

// TestNoUnnecessaryTypeArgumentsLeavesUnresolvedAliasesAlone verifies that
// missing and cyclic aliases retain compiler diagnostics without guessed defaults
// or recovered lint panics.
//
// @evidence contracts/testing.md#behavioral-verification Each real Program must have compiler diagnostics while the actual typed lint cycle produces zero findings, including zero recovered rule failures.
// @evidence contracts/testing.md#independent-expectations The missing module and circular re-export declare no resolvable generic default; their authored invalid import graph independently requires a compiler diagnostic rather than a default-equality judgment.
// @evidence contracts/testing.md#distinguishing-cases A missing module contrasts a present cyclic re-export graph. Valid default-equal and distinct aliases are covered by the imported-alias matrix, so zero findings cannot be the rule's universal behavior.
// @evidence contracts/testing.md#execution-ownership This public Go unit owns both named subcases and loads real compiler and checker state over temporary files, then executes the registered rule in process without a product subprocess or native build.
func TestNoUnnecessaryTypeArgumentsLeavesUnresolvedAliasesAlone(t *testing.T) {
  for _, module := range []string{"missing", "cycle-a"} {
    t.Run(module, func(t *testing.T) {
      root := seedLintProject(t, "import { Box } from './"+module+"';\ntype Result = Box<string>;\n")
      writeFile(t, filepath.Join(root, "src", "cycle-a.ts"), "export { Box } from './cycle-b';\n")
      writeFile(t, filepath.Join(root, "src", "cycle-b.ts"), "export { Box } from './cycle-a';\n")
      prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{forceNoEmit: true, needsRuleChecker: true})
      if err != nil || len(diags) != 0 {
        t.Fatalf("load: err=%v diagnostics=%v", err, diags)
      }
      defer prog.close()
      if len(prog.programDiagnostics()) == 0 {
        t.Fatal("invalid alias input unexpectedly has no compiler diagnostic")
      }
      engine := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{
        "typescript/no-unnecessary-type-arguments": SeverityError,
      }})
      if err := engine.ConfigError(); err != nil {
        t.Fatal(err)
      }
      engine.SetCurrentDirectory(root)
      if findings := prog.runLintCycle(engine); len(findings) != 0 {
        t.Fatalf("unresolved aliases produced lint findings: %+v", findings)
      }
    })
  }
}
