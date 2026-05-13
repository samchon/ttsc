package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunDemoEveryAtomic verifies every supported native demo predicate.
//
// The CLI demo type table is intentionally small and explicit. Each supported
// atomic type should stay reachable through command-line flag parsing rather
// than only through an internal helper.
//
// This scenario converts the old direct helper check into black-box command
// coverage. It preserves the intent while keeping tests out of the production
// command package directory.
//
// 1. Run the demo command for every supported atomic type.
// 2. Capture stdout and stderr for each command.
// 3. Assert successful status and the expected predicate fragment.
func TestCLIRunDemoEveryAtomic(t *testing.T) {
  cases := map[string]string{
    "boolean": `"boolean" === typeof input`,
    "number":  `"number" === typeof input`,
    "bigint":  `"bigint" === typeof input`,
    "any":     `(input) => true`,
  }
  for typ, expected := range cases {
    code, stdout, stderr := runNativeCommand(t, "demo", "--type="+typ)
    if code != 0 || stderr != "" || !strings.Contains(stdout, expected) {
      t.Fatalf("demo --type=%s mismatch: code=%d stdout=%q stderr=%q", typ, code, stdout, stderr)
    }
  }
}
