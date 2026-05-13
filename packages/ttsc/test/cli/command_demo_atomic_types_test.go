package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandDemoAtomicTypes verifies every supported demo atomic type.
//
// The demo command is the smallest native backend smoke path in the CLI. It
// still goes through flag parsing, type dispatch, stdout formatting, and the
// `run` command switch.
//
// 1. Execute `demo` for each documented atomic type.
// 2. Compare each generated predicate with the expected JavaScript fragment.
// 3. Assert every supported type exits successfully.
func TestCLICommandDemoAtomicTypes(t *testing.T) {
  cases := map[string]string{
    "any":     `(input) => true`,
    "bigint":  `"bigint" === typeof input`,
    "boolean": `"boolean" === typeof input`,
    "number":  `"number" === typeof input`,
    "string":  `"string" === typeof input`,
  }

  for typ, expected := range cases {
    t.Run(typ, func(t *testing.T) {
      code, out, errOut := runNativeCommand(t, "demo", "--type="+typ)
      if code != 0 {
        t.Fatalf("demo %s failed: code=%d stdout=%q stderr=%q", typ, code, out, errOut)
      }
      if !strings.Contains(out, expected) {
        t.Fatalf("demo %s output missing %q:\n%s", typ, expected, out)
      }
    })
  }
}
