package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsPositionalPathsDoNotReachDynamicImports verifies A positional blocked path reports a static import but not import() or ordinary require().
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification A positional blocked path reports a static import but not import() or ordinary require().
// @evidence contracts/testing.md#independent-expectations The supported no-restricted-imports operation concerns static import/export syntax; one authored static target is expected despite identical module strings elsewhere.
// @evidence contracts/testing.md#distinguishing-cases Static, dynamic and CommonJS forms share blocked, so treating every string or module operation as static fails.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsPositionalPathsDoNotReachDynamicImports(t *testing.T) {
  source := `import direct from "blocked";
const dynamic = import("blocked");
const commonJS = require("blocked");
JSON.stringify([direct, dynamic, commonJS]);
`
  findings := runNoRestrictedImports(t, source, json.RawMessage(`"blocked"`))
  assertNoRestrictedImportsTargets(t, findings, `"blocked"`)
}
