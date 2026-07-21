package linthost

import (
  "strings"
  "testing"
)

// TestNoArrayDeleteAsksTheTypeNotTheSubscript verifies the rule reports a
// delete on an array and leaves a keyed object alone.
//
// `delete target[key]` is spelled identically for both, so the target's type is
// the only thing that separates them: on an array it leaves a sparse hole, on a
// `Record` or an index signature it is the correct way to remove an entry. The
// rule used to decide from the subscript's syntax — a numeric literal or an
// identifier — which reported every `delete record[key]` and missed
// `delete array[next()]`. Reported externally as #795.
//
//  1. Delete from a Record, an index-signature object, an array by literal, an
//     array by identifier, and an array by call result.
//  2. Run the rule.
//  3. Assert only the three array deletes report.
func TestNoArrayDeleteAsksTheTypeNotTheSubscript(t *testing.T) {
  source := `declare const rec: Record<string, number>;
declare const map: { [k: string]: number };
declare const arr: number[];
declare const pair: [number, number];
declare function next(): number;
declare const k: string;
delete rec[k];
delete map[k];
delete arr[0];
delete arr[next()];
delete pair[1];
`
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/no-array-delete": "error"},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" {
    t.Fatalf("run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-array-delete]"); got != 3 {
    t.Fatalf("expected 3 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:9:", "main.ts:10:", "main.ts:11:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing array delete at %s\n%s", line, stderr)
    }
  }
  for _, line := range []string{"main.ts:7:", "main.ts:8:"} {
    if diagnosticOutputContains(stderr, line) {
      t.Fatalf("keyed object reported at %s\n%s", line, stderr)
    }
  }
}
