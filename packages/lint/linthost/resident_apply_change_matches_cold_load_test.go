package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// residentVarStatementRule reports one finding on every variable statement, so
// the finding count over a file equals its top-level `const`/`let`/`var` count.
// That makes an edit's effect deterministic and observable: add a statement and
// the count rises by one.
type residentVarStatementRule struct{}

func (residentVarStatementRule) Name() string { return "resident-test/var-statement" }

func (residentVarStatementRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}

func (residentVarStatementRule) Check(ctx *publicrule.Context, node *shimast.Node) {
  ctx.Report(node, "variable statement")
}

// TestResidentApplyChangeMatchesColdLoad verifies the aggregate variable-statement
// finding count after a warm Program edit against an independently authored count
// and a cold load of the edited project.
//
// Appending one declaration must raise the aggregate from two to three. This
// distinguishes an ignored edit; cold-count equality is supplementary. The case
// does not compare finding locations, AST object identity or checker-dependent
// diagnostics.
//
//  1. Load a two-file project cold; assert two findings in total.
//  2. Append a statement to one file on disk and applyChange it.
//  3. Assert the warm Program now reports the new count, equal to a fresh cold
//     load of the edited project; the other file is left unchanged on disk.
//
// @evidence contracts/testing.md#behavioral-verification After applyChange on an appended declaration, the synthetic variable rule must report two findings before and three after, matching the edited cold-load count.
// @evidence contracts/testing.md#independent-expectations Literal counts 2 and 3 come from counting authored top-level declarations, independently of either warm or cold compiler result; cold equality is supplementary.
// @evidence contracts/testing.md#distinguishing-cases Appending a declaration in one of two files must raise the warm total from two to three and match a fresh cold total. This distinguishes an ignored edit; file-specific finding survival, AST identity, deletions, renames and type-dependent rules are not asserted.
// @evidence contracts/testing.md#execution-ownership Loads Programs with loadProgram, updates one with program.applyChange and runs an Engine through runLintCycle over temporary files in one process; the synthetic contributor rule is registered in the in-process registry and removed on cleanup.
func TestResidentApplyChangeMatchesColdLoad(t *testing.T) {
  metadata, err := inspectContributor(residentVarStatementRule{})
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["a.ts", "b.ts"]
}
`)
  writeFile(t, filepath.Join(root, "a.ts"), "export const a = 1;\n")
  writeFile(t, filepath.Join(root, "b.ts"), "export const b = 2;\n")

  newEngine := func() *Engine {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules: RuleConfig{metadata.name: SeverityError},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("engine config: %v", err)
    }
    engine.SetCurrentDirectory(root)
    return engine
  }

  warm, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{forceNoEmit: true})
  if err != nil {
    t.Fatalf("cold loadProgram: %v", err)
  }
  if len(diags) != 0 {
    t.Fatalf("cold loadProgram diagnostics: %+v", diags)
  }
  defer warm.close()
  if got := len(warm.runLintCycle(newEngine())); got != 2 {
    t.Fatalf("cold findings before edit = %d, want 2 (one per file)", got)
  }

  // Append a second statement to b.ts on disk, then update the warm Program for
  // just that file. a.ts is untouched and its AST must be reused.
  writeFile(t, filepath.Join(root, "b.ts"), "export const b = 2;\nexport const c = 3;\n")
  warm.applyChange(filepath.Join(root, "b.ts"))
  incremental := len(warm.runLintCycle(newEngine()))
  if incremental != 3 {
    t.Fatalf("incremental findings after edit = %d, want 3 (a.ts reused + b.ts re-parsed)", incremental)
  }

  cold, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{forceNoEmit: true})
  if err != nil {
    t.Fatalf("edited cold loadProgram: %v", err)
  }
  if len(diags) != 0 {
    t.Fatalf("edited cold loadProgram diagnostics: %+v", diags)
  }
  defer cold.close()
  if want := len(cold.runLintCycle(newEngine())); incremental != want {
    t.Fatalf("incremental findings = %d, cold-load findings = %d; an incremental update must equal a rebuild", incremental, want)
  }
}
