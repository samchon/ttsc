package linthost

import (
  "fmt"
  "os"
  "path/filepath"
  "testing"
)

// TestResidentRuleCacheRespectsConfigCacheOptOut verifies the resident daemon
// re-evaluates an executable config on every request while caching is disabled.
//
// The opt-out exists for configs that depend on state outside the tracked
// module graph. Disabling only the inner evaluator cache would be ineffective
// if the daemon's outer resolver memo continued serving the first result.
//
//  1. Start `lsp-serve` with an executable config and the opt-out enabled.
//  2. Ask `project-inputs` twice without changing any tracked input.
//  3. Require two resolver loads and two executable-config evaluations.
func TestResidentRuleCacheRespectsConfigCacheOptOut(t *testing.T) {
  installResidentConfigProjectInputRule(t)
  root := seedLintProject(t, "export const value = 1;\n")
  packageRoot := filepath.Join(
    root,
    "node_modules",
    "resident-config-dependency",
  )
  seedResidentConfigDependency(t, packageRoot, "docs/input.md")
  writeResidentProjectInputConfig(t, root)

  evaluations := filepath.Join(root, "evaluations.txt")
  if err := os.WriteFile(evaluations, nil, 0o644); err != nil {
    t.Fatalf("seed evaluation log: %v", err)
  }
  t.Setenv("TTSC_LINT_TEST_EVALUATIONS", evaluations)
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "1")
  ask, closeDaemon := startResidentProjectInputDaemon(t, root)
  defer closeDaemon()

  for request := 1; request <= 2; request++ {
    snapshot := ask(fmt.Sprintf("cache-disabled request %d", request))
    assertResidentProjectInput(t, snapshot, root, "docs/input.md", true)
  }
  assertResidentRuleLoads(t, 2)
  assertResidentConfigEvaluations(t, evaluations, 2)
}
