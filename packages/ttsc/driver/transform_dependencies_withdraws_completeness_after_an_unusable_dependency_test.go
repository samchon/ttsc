package driver

import "testing"

// TestTransformDependenciesWithdrawsCompletenessAfterAnUnusableDependency
// verifies a dependency the host could not key withdraws the claim it belonged
// to, instead of leaving a complete list with a member missing from it.
//
// A plugin whose own lookup answered nothing for one input is the case: it
// reports what it has and declares the file complete, and a host that dropped
// the unusable member would publish exactly the under-declaration the protocol
// blames on the plugin — manufactured by the host. Only the affected file loses
// the claim; the plugin's other files keep theirs.
func TestTransformDependenciesWithdrawsCompletenessAfterAnUnusableDependency(t *testing.T) {
  cwd := t.TempDir()
  declarations := newPluginFileDeclarations()
  record := declarations.forPlugin(0)
  ctx := PluginContext{
    Cwd:                          cwd,
    reportFileDependency:         record.addDependency,
    reportFileDependencyRejected: record.rejectDependency,
    reportEveryFileComplete:      record.completeEveryFile,
  }

  ctx.ReportDependenciesComplete()
  ctx.ReportFileDependency("src/main.ts", "")

  out := aggregateTransformDependencies(
    []string{"src/main.ts", "src/other.ts"},
    []int{0},
    declarations,
  )

  if len(out.Complete) != 1 || out.Complete[0] != "src/other.ts" {
    t.Fatalf("expected only the unaffected file to stay complete, got %v", out.Complete)
  }
}
