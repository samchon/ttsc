package linthost

import "testing"

// TestBoundariesDependenciesGatesAndSelectsNonLocalOrigins verifies external
// and core dependencies participate only when explicitly requested.
//
// The package-name candidate must match a subpath without overmatching an
// unrelated external import, and `node:` must remain distinguishable as core.
// This is the negative twin for accidental all-origin evaluation.
//
// 1. Import a blocked package subpath, an allowed package, and a core module.
// 2. Run with and without `checkAllOrigins` using origin/source selectors.
// 3. Assert the enabled run reports exactly the blocked package and core module.
//
// @evidence contracts/testing.md#behavioral-verification Nonlocal origin checks are gated off by default, then reject only the configured legacy package and core fs while retaining react.
// @evidence contracts/testing.md#independent-expectations The explicit external package-prefix and core selectors independently determine the literal legacy/fs targets; checkAllOrigins decides whether they participate.
// @evidence contracts/testing.md#distinguishing-cases Default-gate zero, enabled external/core findings and unmatched react control distinguish gating from origin selection.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run for the default origin gate and checkAllOrigins-enabled policy. This entry owns the external/core/unmatched target distinctions in one Go process.
func TestBoundariesDependenciesGatesAndSelectsNonLocalOrigins(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"@legacy/sdk/client\";\nimport \"react\";\nimport \"node:fs\";\n"
  base := `
    "elements":[{"type":"app","pattern":"src/app/**"}],
    "default":"allow",
    "policies":[
      {"from":"app","disallow":{"to":{"origin":"external","source":"@legacy/sdk"}}},
      {"from":"app","disallow":{"to":{"origin":"core"}}}
    ]`

  skipped := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`}`, nil)
  if len(skipped) != 0 {
    t.Fatalf("default origin gate: want no findings, got %+v", skipped)
  }

  checked := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,"checkAllOrigins":true}`, nil)
  assertBoundaryFindingTexts(t, source, checked, `"@legacy/sdk/client"`, `"node:fs"`)
}
