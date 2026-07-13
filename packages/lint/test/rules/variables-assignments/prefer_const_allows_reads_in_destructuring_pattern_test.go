package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstAllowsReadsInDestructuringPattern verifies only write targets constrain conversion.
//
// Member access in a computed property key or default expression is a read,
// not a non-identifier assignment target. Both declaration-only bindings can
// therefore still establish their sole value through the destructuring.
//
//  1. Assign two declaration-only bindings through computed-key and default patterns.
//  2. Put member access in the read-only portion of each pattern.
//  3. Assert both bindings are reported and no read is mistaken for a target.
func TestPreferConstAllowsReadsInDestructuringPattern(t *testing.T) {
  root := seedLintProject(t, `const input = { first: 1, second: 2 };
const keys = { current: "first" as const };

let computed: number;
({ [keys.current]: computed } = input);

let defaulted: number;
({ second: defaulted = input.second } = {} as Partial<typeof input>);

console.log(computed, defaulted);
`)
  seedLintRules(t, root, map[string]string{"prefer-const": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const destructuring-read diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
