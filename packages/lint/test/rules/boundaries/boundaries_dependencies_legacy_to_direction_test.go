package linthost

import "testing"

// TestBoundariesDependenciesTreatsLegacyEntryAsSourceForToPolicies verifies a
// legacy string effect selects the importer when the policy declares only `to`.
//
// Upstream maps string entries to the direction the policy leaves open: with
// `from` present they select targets, without it they select sources. Wiring
// both cases to targets would make `{"to":..., "disallow":...}` unsatisfiable
// and silently disable every target-rooted legacy policy.
//
// 1. Deny app sources on the domain target with a string `disallow` entry.
// 2. Import the domain model from an app file and from a shared file.
// 3. Assert only the app-origin dependency reports, at its exact range.
func TestBoundariesDependenciesTreatsLegacyEntryAsSourceForToPolicies(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain/model\";\n"
  files := map[string]string{"src/domain/model.ts": "export {};"}
  options := `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"},
      {"type":"shared","pattern":"src/shared/**"}
    ],
    "default":"allow",
    "policies":[{"to":"domain","disallow":"app"}]
  }`

  denied := runBoundaryRule(t, ruleName, "src/app/main.ts", source, options, files)
  assertSingleBoundaryFinding(t, ruleName, denied, `policy at index 0`)
  assertBoundaryFindingTexts(t, source, denied, `"../domain/model"`)

  allowed := runBoundaryRule(t, ruleName, "src/shared/main.ts", source, options, files)
  if len(allowed) != 0 {
    t.Fatalf("shared source must not match the legacy app entry, got %+v", allowed)
  }
}
