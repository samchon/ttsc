package linthost

import "testing"

// TestBoundariesDependenciesGatesInternalAndUnknownTargets verifies the two
// local-dependency opt-in boundaries.
//
// Same-element imports and unclassified local targets are skipped by default,
// even under a disallow fallback. Enabling the corresponding flags must expose
// both to the same policy engine without changing known cross-element behavior.
//
// 1. Import one app-local file and one unclassified shared file.
// 2. Run the disallow fallback with both gates disabled and enabled.
// 3. Assert the enabled run reports both exact module literals.
// 4. Enable each gate alone and assert only its own edge reports.
//
// @evidence contracts/testing.md#behavioral-verification Internal and unknown-local edges are skipped by default and checked when both gates are enabled.
// @evidence contracts/testing.md#independent-expectations The local file belongs to app while shared/util lacks a configured element; authored checkInternals/checkUnknownLocals options determine the expected two targets.
// @evidence contracts/testing.md#distinguishing-cases Same-element and unmatched-local inputs each cross a different gate, with zero, two-finding and single-gate one-finding results showing that neither flag exposes the other's edge.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run with the gate-disabled and gate-enabled options. This entry owns the internal and unknown-local pair under both configurations.
func TestBoundariesDependenciesGatesInternalAndUnknownTargets(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"./local\";\nimport \"../shared/util\";\n"
  files := map[string]string{
    "src/app/local.ts":   "export {};",
    "src/shared/util.ts": "export {};",
  }
  base := `"elements":[{"type":"app","pattern":"src/app/**"}]`

  skipped := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`}`, files)
  if len(skipped) != 0 {
    t.Fatalf("default local gates: want no findings, got %+v", skipped)
  }

  checked := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,"checkInternals":true,"checkUnknownLocals":true}`, files)
  assertBoundaryFindingTexts(t, source, checked, `"./local"`, `"../shared/util"`)

  internalsOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,"checkInternals":true}`, files)
  assertBoundaryFindingTexts(t, source, internalsOnly, `"./local"`)

  unknownOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,"checkUnknownLocals":true}`, files)
  assertBoundaryFindingTexts(t, source, unknownOnly, `"../shared/util"`)
}
