package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsPositionalPathsDoNotReachDynamicImports verifies a
// positional restricted path reports a static import but not `import()` or
// `require()` of the same module.
//
// 1. Run the rule with the positional path "blocked" over a source that loads
//    "blocked" statically, dynamically and through require().
// 2. Compare the reported ranges with the single literal target.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one finding is reported, at the specifier of the static `import direct from "blocked"`; the dynamic import() call and the CommonJS require() call on the following lines are not reported.
// @evidence contracts/testing.md#independent-expectations no-restricted-imports concerns static import and export syntax, so one literal static target is expected although the same module string is loaded elsewhere in the source.
// @evidence contracts/testing.md#distinguishing-cases Static, dynamic and CommonJS loads of the same blocked module share one source, so a rule that treated every string or module operation as an import would report three findings.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the one literal spelling, and the Test independently pins the static import offset; it asserts no messages.
func TestNoRestrictedImportsPositionalPathsDoNotReachDynamicImports(t *testing.T) {
  source := `import direct from "blocked";
const dynamic = import("blocked");
const commonJS = require("blocked");
JSON.stringify([direct, dynamic, commonJS]);
`
  findings := runNoRestrictedImports(t, source, json.RawMessage(`"blocked"`))
  assertNoRestrictedImportsTargets(t, findings, `"blocked"`)
  expected := len(`import direct from `)
  if findings[0].pos != expected {
    t.Fatalf("finding position = %d, want static import at %d: %+v", findings[0].pos, expected, findings[0])
  }
}
