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
//
// @evidence contracts/testing.md#behavioral-verification The legacy element-types rule rejects a domain import but leaves app/local alone.
// @evidence contracts/testing.md#independent-expectations Explicit app-disallow-domain rules independently establish the one diagnostic; the local fixture belongs to app rather than domain.
// @evidence contracts/testing.md#distinguishing-cases Cross-element and internal same-element imports share one source to guard against unconditional rejection.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run on the cross-element and local fixture imports. This Test owns assertSingleBoundaryFinding and its implicit zero-report local control.
func TestBoundariesElementTypesRejectsDisallowedImport(t *testing.T) {
  const ruleName = "boundaries/element-types"
  source := `
    import "../domain/internal";
    import "./local";
  `
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
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
  if got := source[findings[0].Pos:findings[0].End]; got != `"../domain/internal"` {
    t.Fatalf("finding range text = %q, want %s", got, `"../domain/internal"`)
  }
}
