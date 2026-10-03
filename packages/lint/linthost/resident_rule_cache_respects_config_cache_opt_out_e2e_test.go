//go:build e2e

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
//
// @evidence contracts/testing.md#behavioral-verification Exercises the persistent LSP project-input loop and executable-config evaluator with caching disabled; asserts the expected project input on both requests and exactly two rule-resolver loads and executable evaluations, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations An imported module writes one independent counter record per evaluation; two unchanged requests under the documented opt-out require two records.
// @evidence contracts/testing.md#distinguishing-cases This case owns unchanged tracked bytes must not bypass explicit cache disable in either the outer resolver or inner evaluator; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestResidentRuleCacheRespectsConfigCacheOptOut by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
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
