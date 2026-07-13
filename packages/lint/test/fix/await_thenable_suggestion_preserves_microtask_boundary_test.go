package linthost

import (
  "os/exec"
  "strings"
  "testing"
)

// TestAwaitThenableSuggestionPreservesMicrotaskBoundary proves why the await
// removal cannot enter automatic fixing: the original and opt-in rewrite have
// observably different ordering.
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
