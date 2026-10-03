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
// Boundary: Actual rule-produced source crosses into the Node runtime. Direct Go edit assertions cannot establish JavaScript continuation ordering; the two literal traces observe the host behavior behind the opt-in choice.
// Preparation: The current nativeLintConnections entry batches this named case with other Go connections in one invocation. This donor still loads one typed fixture and launches two Node children, one for each source. Consolidation into the shared consumer profile remains unfinished; this declaration does not certify minimum preparation or completed migration.
// State and lifetime: The snapshot owns a unique temporary project and closes its checker through the helper. Each Node child starts with its own log and microtask queue; CombinedOutput waits for that child before the next trace. No environment or installed artifact is mutated. These calls have no cancellation or timeout bound, and forced termination does not prove fixture cleanup.
// Preserved assertions: This retained donor requires suggestion count one, automatic zero edits with unchanged source, explicit one edit and both literal runtime traces. Exact token/trivia edits are owned by AwaitExpressionOffersExactSuggestion. The consumer-side transfer has no completed body or execution evidence yet, so this donor remains selected and is not deleted.
//
// @evidence contracts/testing.md#behavioral-verification Exercises the in-process Go await-thenable finding/fix operations and real Node execution. One suggestion, unchanged automatic source, one opt-in edit and literal before/sync/after versus before/after/sync traces distinguish the scheduling change.
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
  cmd := exec.Command("node", "-e", source)
  observation := newLintTraceInvocation()
  observeLintCommandArtifact(observation, cmd.Path, "await-thenable-node-oracle", "await-thenable-node-artifact")
  lower := recordLintCommandAttempt(observation, cmd, "await-thenable-node-oracle")
  output, err := cmd.CombinedOutput()
  recordLintCommandResult(observation, cmd, "await-thenable-node-oracle", "CombinedOutput", lower, err)
  if err != nil {
    t.Fatalf("node failed: %v\n%s", err, output)
  }
  return strings.TrimSpace(string(output))
}
