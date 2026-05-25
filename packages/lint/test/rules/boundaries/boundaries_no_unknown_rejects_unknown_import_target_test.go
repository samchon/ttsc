package linthost

import "testing"

// TestBoundariesNoUnknownRejectsUnknownImportTarget verifies
// boundaries/no-unknown rejects a relative import whose resolved file does not
// match any configured element.
//
// This covers the progressive-adoption guard: projects can declare the element
// graph they care about and then detect dependencies that fall outside that
// graph without enabling file-wide unknown checks yet.
//
// 1. Materialize an app source file and a shared utility file.
// 2. Configure only app and domain source-path elements.
// 3. Assert the app import of the shared utility reports exactly one finding.
func TestBoundariesNoUnknownRejectsUnknownImportTarget(t *testing.T) {
	const ruleName = "boundaries/no-unknown"
	findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../shared/util";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" }
    ]
  }`, map[string]string{
		"src/shared/util.ts": "export {};",
	})
	assertSingleBoundaryFinding(t, ruleName, findings, `does not match any configured boundary element`)
}
