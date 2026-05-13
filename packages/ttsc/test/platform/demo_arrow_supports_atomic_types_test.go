package ttsc_test

import (
  "strings"
  "testing"
)

// TestDemoArrowSupportsAtomicTypes verifies every demo predicate branch.
//
// The platform test package exercises the installed helper as an external
// command. Each supported atom must still flow through the command parser into
// the predicate table and produce deterministic JavaScript.
//
// This scenario covers every successful demo branch through `go run
// ./cmd/platform`. That keeps the tests out of the production package while
// still preserving the same behavior coverage.
//
// 1. Invoke the demo command for every supported atomic type.
// 2. Compare each returned JavaScript predicate text.
// 3. Assert each supported branch exits successfully without stderr.
func TestDemoArrowSupportsAtomicTypes(t *testing.T) {
  cases := map[string]string{
    "any":     "(input) => true",
    "boolean": `(input) => "boolean" === typeof input`,
    "number":  `(input) => "number" === typeof input`,
    "bigint":  `(input) => "bigint" === typeof input`,
    "string":  `(input) => "string" === typeof input`,
    "":        `(input) => "string" === typeof input`,
  }
  for input, expected := range cases {
    args := []string{"demo"}
    if input != "" {
      args = append(args, "--type="+input)
    }
    code, stdout, stderr := runPlatformCommand(t, args...)
    if code != 0 || stderr != "" || !strings.Contains(stdout, expected) {
      t.Fatalf("demo branch %q mismatch: code=%d stdout=%q stderr=%q", input, code, stdout, stderr)
    }
  }
}
