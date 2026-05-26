package linthost

import "testing"

// TestBoundariesNoPrivateRejectsCrossElementPrivateImport verifies
// boundaries/no-private rejects another element's configured private files.
//
// The rule protects element internals while still allowing files inside the same
// element root to share private helpers. This test covers the cross-element
// branch that must report a diagnostic.
//
// 1. Materialize app and domain elements with a domain internal file.
// 2. Configure domain internal/** as private.
// 3. Assert the app file's import of the domain private file reports.
func TestBoundariesNoPrivateRejectsCrossElementPrivateImport(t *testing.T) {
	const ruleName = "boundaries/no-private"
	findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal/secret";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**", "private": "internal/**" }
    ]
  }`, map[string]string{
		"src/domain/internal/secret.ts": "export {};",
	})
	assertSingleBoundaryFinding(t, ruleName, findings, `private boundary file`)
}
