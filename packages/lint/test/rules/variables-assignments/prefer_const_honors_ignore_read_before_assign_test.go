package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstHonorsIgnoreReadBeforeAssign verifies first-assignment option semantics.
//
// A declaration followed by one same-scope assignment is const-eligible. A
// prior closure read is still reported by default, but the explicit option
// suppresses that binding while leaving an unread sibling eligible.
//
//  1. Declare two uninitialized bindings and assign each exactly once.
//  2. Read one binding in a function written before its assignment.
//  3. Compare the default two findings with the option-enabled single finding.
func TestPreferConstHonorsIgnoreReadBeforeAssign(t *testing.T) {
  source := `let assignedLater: number;
assignedLater = 1;

let readBeforeAssign: number;
function read(): number {
  return readBeforeAssign;
}
readBeforeAssign = 2;

console.log(assignedLater, read());
`

  defaultRoot := seedLintProject(t, source)
  seedLintRules(t, defaultRoot, map[string]string{"prefer-const": "error"})
  defaultCode, defaultStdout, defaultStderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", defaultRoot, "--plugins-json", lintManifest(t)})
  })
  if defaultCode != 2 || defaultStdout != "" || strings.Count(defaultStderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const default read-before diagnostics mismatch: code=%d stdout=%q stderr=%q", defaultCode, defaultStdout, defaultStderr)
  }

  ignoredRoot := seedLintProject(t, source)
  seedLintConfig(t, ignoredRoot, map[string]any{
    "rules": map[string]any{
      "prefer-const": []any{"error", map[string]any{"ignoreReadBeforeAssign": true}},
    },
  })
  ignoredCode, ignoredStdout, ignoredStderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", ignoredRoot, "--plugins-json", lintManifest(t)})
  })
  if ignoredCode != 2 || ignoredStdout != "" || strings.Count(ignoredStderr, "[prefer-const]") != 1 {
    t.Fatalf("prefer-const ignored read-before diagnostics mismatch: code=%d stdout=%q stderr=%q", ignoredCode, ignoredStdout, ignoredStderr)
  }
}
