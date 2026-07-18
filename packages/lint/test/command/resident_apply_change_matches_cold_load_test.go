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

// TestResidentApplyChangeMatchesColdLoad verifies that updating a warm Program
// with applyChange after a file changes yields the same findings a cold load of
// the edited project would — the correctness property the resident daemon rests
// on.
//
// applyChange re-parses only the changed file and reuses every other file's AST.
// If the reused ASTs or the rebuilt checker drifted from a fresh compile, the
// resident daemon would report stale or wrong findings that a one-shot run never
// would. This pins that an incremental update equals a rebuild, and that the
// edit actually took effect (the count rises), so the test cannot pass by the
// update silently doing nothing.
//
//  1. Load a two-file project cold; assert one finding per file.
//  2. Append a statement to one file on disk and applyChange it.
//  3. Assert the warm Program now reports the new count, equal to a fresh cold
//     load of the edited project, with the other file's findings intact.
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
