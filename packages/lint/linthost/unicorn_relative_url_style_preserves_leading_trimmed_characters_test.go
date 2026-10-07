package linthost

import (
  "fmt"
  "testing"
)

// TestUnicornRelativeURLStylePreservesLeadingTrimmedCharacters checks that
// removing a relative prefix does not expose URL parser trimming semantics.
//
//  1. Parse each literal with the actual lint engine in this process.
//  2. Require no recommendation for values whose leading space or C0 byte would
//     become an authority, query, fragment, or changed path after removal.
//  3. Keep ordinary relative paths as positive recommendation controls.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual relative-url-style rule through the parser and Engine.Run helper and asserts the exact finding count and rule identity for each authored URL expression.
// @evidence contracts/testing.md#independent-expectations Literal negative expectations follow WHATWG URL leading C0 and space trimming: the characters inside the original path survive, while prefix removal exposes trimming. The ordinary path controls preserve URL identity and owe one recommendation.
// @evidence contracts/testing.md#distinguishing-cases Space before authority, query, fragment and backslash, plus NUL and U+001F path prefixes, distinguish the trimming class from ordinary paths and an interior space that remains interior after removal.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls the real in-process parser and lint engine with authored strings; no browser, network, Node child, native compiler build or installed consumer is needed for diagnostic policy.
func TestUnicornRelativeURLStylePreservesLeadingTrimmedCharacters(t *testing.T) {
  const rule = "unicorn/relative-url-style"
  for _, row := range []struct {
    name, value string
    findings    int
  }{
    {"space-authority", "./ //host/path", 0},
    {"space-query", "./ ?x", 0},
    {"space-fragment", "./ #x", 0},
    {"space-backslash", "./ \\file", 0},
    {"space-path", "./ file", 0},
    {"nul-path", "./\x00file", 0},
    {"c0-path", "./\x1ffile", 0},
    {"ordinary-path", "./file", 1},
    {"interior-space", "./a file", 1},
  } {
    t.Run(row.name, func(t *testing.T) {
      source := fmt.Sprintf("const value = new URL(%q, 'https://base/dir/file');", row.value)
      _, _, findings := runRuleFindingsSnapshot(t, rule, source, nil)
      if len(findings) != row.findings {
        t.Fatalf("%q: want %d findings, got %+v", row.value, row.findings, findings)
      }
      if len(findings) == 1 && (findings[0].Rule != rule || findings[0].Severity != SeverityError) {
        t.Fatalf("want owning rule error, got %+v", findings)
      }
    })
  }
}
