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
//
// @evidence contracts/testing.md#behavioral-verification The command retains default two and configured one findings and checks precise binding sites, exposing a wrong surviving binding or location.
// @evidence contracts/testing.md#independent-expectations The unread assignedLater reports its assignment at 2:1; default readBeforeAssign reports its declaration at 4:5 because its read precedes assignment. The enabled option suppresses only the latter.
// @evidence contracts/testing.md#distinguishing-cases The same source runs with and without ignoreReadBeforeAssign; the unread sibling must remain reportable under both settings, preserving option locality.
// @evidence contracts/testing.md#execution-ownership TestPreferConstHonorsIgnoreReadBeforeAssign owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes the owning operation with a real Program and Checker and isolated fixture files, without a consumer install, native artifact build or product host.
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
  assertBindingDiagnosticSites(t, defaultStderr, [][2]int{{2, 1}, {4, 5}})
  assertBindingDiagnosticSites(t, ignoredStderr, [][2]int{{2, 1}})
}
