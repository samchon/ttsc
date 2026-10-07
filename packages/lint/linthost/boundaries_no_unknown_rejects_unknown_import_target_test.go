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
//
// @evidence contracts/testing.md#behavioral-verification Unknown-boundary checking reports shared/util and lists configured app/domain while leaving an app/local import clean.
// @evidence contracts/testing.md#independent-expectations The fixture shared path matches no authored element pattern; app/local does. Literal configured-element message names express the supplied policy, not a repository layout check.
// @evidence contracts/testing.md#distinguishing-cases Unknown and known local targets coexist, with exact one-report and configured-set message assertions.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run for authored unmatched shared and known app paths. This entry owns the one-finding and configured-element message checks.
func TestBoundariesNoUnknownRejectsUnknownImportTarget(t *testing.T) {
  const ruleName = "boundaries/no-unknown"
  source := `
    import "../shared/util";
    import "./local";
  `
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" }
    ]
  }`, map[string]string{
    "src/shared/util.ts": "export {};",
    "src/app/local.ts":   "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `does not match any configured boundary element`)
  // The rule holds the configured element types at the moment it reports, so
  // the message names them rather than leaving the reader to open lint.config.
  assertSingleBoundaryFinding(t, ruleName, findings, `Configured elements: app, domain.`)
  if got := source[findings[0].Pos:findings[0].End]; got != `"../shared/util"` {
    t.Fatalf("finding range text = %q, want %s", got, `"../shared/util"`)
  }
}
