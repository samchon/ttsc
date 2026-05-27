package linthost

import "testing"

// TestBoundariesDependenciesLoadsWithoutDiagnostics verifies the
// `boundaries/dependencies` rule registers, accepts the upstream
// `elements` + `rules` config shape, and silently passes for any file
// in the v1 stub release.
//
// The unified rule will eventually subsume `element-types`,
// `entry-point`, `external`, `no-private`, and `no-unknown`. Until that
// port lands, this test pins the contract: configs may claim the rule
// id today without breaking lint runs, and no diagnostic appears for
// files the legacy split rules would have flagged.
//
// 1. Materialize an app/domain project that `element-types` would flag.
// 2. Configure `boundaries/dependencies` with the equivalent policy.
// 3. Assert zero findings (stub behavior).
func TestBoundariesDependenciesLoadsWithoutDiagnostics(t *testing.T) {
	const ruleName = "boundaries/dependencies"
	if LookupRule(ruleName) == nil {
		t.Fatalf("missing %s rule registration", ruleName)
	}
	findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal";
    import "./local";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" }
    ],
    "rules": [
      { "from": "app", "disallow": "domain" }
    ]
  }`, map[string]string{
		"src/app/local.ts":       "export {};",
		"src/domain/internal.ts": "export {};",
	})
	if len(findings) != 0 {
		t.Fatalf("%s v1 stub must not emit diagnostics yet, got %d (%+v)", ruleName, len(findings), findings)
	}
}
