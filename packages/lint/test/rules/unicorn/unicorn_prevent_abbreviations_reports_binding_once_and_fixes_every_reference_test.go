package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsReportsBindingOnceAndFixesEveryReference verifies that actual lint/fix execution requires one binding report, three edits and authored full output.
//
// Binding identity independently requires changing idx declaration/read while preserving shorthand property key.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual lint/fix execution requires one binding report, three edits and authored full output.
// @evidence contracts/testing.md#independent-expectations Binding identity independently requires changing idx declaration/read while preserving shorthand property key.
// @evidence contracts/testing.md#distinguishing-cases Parameter, direct read and object shorthand become index/index/idx:index with one report.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsReportsBindingOnceAndFixesEveryReference owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsReportsBindingOnceAndFixesEveryReference(t *testing.T) {
  source := "function read(idx: number) {\n  const value = idx;\n  return { idx };\n}\nvoid read;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("expected one binding diagnostic, got %d (%+v)", len(findings), findings)
  }
  if len(findings[0].Fix) != 3 {
    t.Fatalf("expected declaration and two reference edits, got %+v", findings[0].Fix)
  }
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function read(index: number) {\n  const value = index;\n  return { idx: index };\n}\nvoid read;\n",
  )
}
