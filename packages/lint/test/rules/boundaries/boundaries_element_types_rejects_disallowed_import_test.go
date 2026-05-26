package linthost

import "testing"

// TestBoundariesElementTypesRejectsDisallowedImport verifies boundaries/element-types
// blocks a static import when the source and target files classify into a
// disallowed element-type pair.
//
// This pins the first TypeScript source-path policy slice: app files may import
// app files, but an app file importing a domain implementation must surface as a
// diagnostic rather than silently depending on an internal layer.
//
// 1. Materialize app and domain files in a temporary project tree.
// 2. Configure app and domain elements plus an app -> domain disallow policy.
// 3. Assert the app import of the domain file reports exactly one finding.
func TestBoundariesElementTypesRejectsDisallowedImport(t *testing.T) {
	const ruleName = "boundaries/element-types"
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
	assertSingleBoundaryFinding(t, ruleName, findings, `domain`)
}
