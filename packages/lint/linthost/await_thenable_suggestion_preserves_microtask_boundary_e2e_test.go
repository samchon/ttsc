//go:build e2e

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
//  1. Run await-thenable on a program that awaits a literal zero and require
//     one finding carrying one suggestion.
//  2. Require the automatic fix pass to leave the source unchanged, and apply
//     the suggestion's edit as an explicit opt-in.
//  3. Execute the original and rewritten programs with Node and require the
//     orders before,sync,after and before,after,sync.
//
// @evidence contracts/testing.md#behavioral-verification Exercises the native await-thenable finding/fix operations and actual Node microtask execution; asserts one suggestion, no automatic source change, one opt-in edit, original before/sync/after and rewritten before/after/sync order, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations ECMAScript await introduces an asynchronous continuation even for zero; literal observed orders establish why removal is a manual suggestion.
// @evidence contracts/testing.md#distinguishing-cases This case owns the automatic path preserves the await boundary while an explicit suggestion changes observable ordering; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestAwaitThenableSuggestionPreservesMicrotaskBoundary by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry's failure identity; ordinary Go unit execution does not select this tagged file.
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
