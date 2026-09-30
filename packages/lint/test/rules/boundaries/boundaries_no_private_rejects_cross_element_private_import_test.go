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
//
// @evidence contracts/testing.md#behavioral-verification The private-boundary rule rejects app importing domain/internal/secret and permits domain/public.
// @evidence contracts/testing.md#independent-expectations The authored internal/** private pattern excludes public.ts; one literal private-boundary diagnostic is expected independently of filesystem discovery output.
// @evidence contracts/testing.md#distinguishing-cases Private and public paths in the same domain element distinguish visibility from rejecting every cross-element edge.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run against the authored private/public fixture paths. This entry owns assertSingleBoundaryFinding and the implicit no-report public control.
func TestBoundariesNoPrivateRejectsCrossElementPrivateImport(t *testing.T) {
  const ruleName = "boundaries/no-private"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal/secret";
    import "../domain/public";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**", "private": "internal/**" }
    ]
  }`, map[string]string{
    "src/domain/internal/secret.ts": "export {};",
    "src/domain/public.ts": "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `private boundary file`)
}
