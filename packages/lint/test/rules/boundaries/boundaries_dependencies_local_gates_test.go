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
}
