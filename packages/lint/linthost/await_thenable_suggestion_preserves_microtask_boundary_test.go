package linthost

import (
  "os/exec"
  "strings"
  "testing"
)

// TestAwaitThenableSuggestionPreservesMicrotaskBoundary proves why the await
// removal cannot enter automatic fixing: the original and opt-in rewrite have
// observably different ordering.
//
// @evidence contracts/testing.md#behavioral-verification Exercises the native await-thenable finding/fix operations and actual Node microtask execution; asserts one suggestion, no automatic source change, one opt-in edit, original before/sync/after and rewritten before/after/sync order, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations ECMAScript await introduces an asynchronous continuation even for zero; literal observed orders establish why removal is a manual suggestion.
// @evidence contracts/testing.md#distinguishing-cases This case owns the automatic path preserves the await boundary while an explicit suggestion changes observable ordering; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableSuggestionPreservesMicrotaskBoundary is discovered from test/e2e by the flattened lint runner and called once under TestSelectedLintBoundaries; its named subcases retain inputs, assertions and failure identity.
// @evidence contracts/e2e.md#necessary-boundary The actual connection is the native await-thenable finding/fix operations and actual Node microtask execution; direct native operation calls cannot prove that separate evaluator, formatter, binary-stdin or JavaScript runtime behavior.
// @evidence contracts/e2e.md#shared-execution One native Go test process computes both forms; two Node executions require separate microtask queues to prevent one program determining the other result.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each Node child owns and terminates its own event loop and receives only the corresponding source; the rule fixture is temporary and neither program shares retained globals.
// @evidence contracts/e2e.md#preserved-coverage Keeps one suggestion, no automatic source change, one opt-in edit, original before/sync/after and rewritten before/after/sync order and every original input/control branch; preparation sharing changes no expected result or admitted case.
func TestAwaitThenableSuggestionPreservesMicrotaskBoundary(t *testing.T) {
  source := `const log = [];
async function run() {
  log.push("before");
  await 0;
  log.push("after");
}
void run();
log.push("sync");
void Promise.resolve().then(() => console.log(log.join(",")));
`
  _, _, findings := runRuleFindingsSnapshot(t, "typescript/await-thenable", source, nil)
  if len(findings) != 1 || len(findings[0].Suggestions) != 1 {
    t.Fatalf("findings = %+v", findings)
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic path changed the microtask boundary: applied=%d", applied)
  }
  rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: findings[0].Suggestions[0].Edits}})
  if applied != 1 {
    t.Fatalf("suggestion applied edits = %d, want 1", applied)
  }
  if got := runAwaitMicrotaskProgram(t, source); got != "before,sync,after" {
    t.Fatalf("original order = %q", got)
  }
  if got := runAwaitMicrotaskProgram(t, rewritten); got != "before,after,sync" {
    t.Fatalf("suggested order = %q", got)
  }
}

func runAwaitMicrotaskProgram(t *testing.T, source string) string {
  t.Helper()
  output, err := exec.Command("node", "-e", source).CombinedOutput()
  if err != nil {
    t.Fatalf("node failed: %v\n%s", err, output)
  }
  return strings.TrimSpace(string(output))
}
