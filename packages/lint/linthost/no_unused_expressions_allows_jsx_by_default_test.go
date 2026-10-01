package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsAllowsJsxByDefault verifies no-unused-expressions accepts JSX statements under default options.
//
// Locks the `enforceForJSX` default arm of `noUnusedExpressionsDisallows`:
// upstream accepts JSX elements, self-closing elements, and fragments as
// statements unless `enforceForJSX` is explicitly enabled, because rendering
// libraries may evaluate them for side effects.
//
// 1. Parse a TSX file with element, self-closing, and fragment statements.
// 2. Run the native Engine with only no-unused-expressions enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for all original standalone component/element/fragment expressions and a JSX-consuming call.
// @evidence contracts/testing.md#independent-expectations The default enforceForJSX false contract independently allows standalone JSX; this does not prove that constructing each node produces runtime effects.
// @evidence contracts/testing.md#distinguishing-cases Default component/element/fragment expressions remain clean; HonorsEnforceForJsx runs the same source with the option enabled and reports only the standalone three.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsAllowsJsxByDefault is selected in the shared Go unit population. It calls parseTSXFile and Engine.Run directly on the complete original JSX source. No installed consumer, native artifact build or real product host runs.
func TestNoUnusedExpressionsAllowsJsxByDefault(t *testing.T) {
  source := `declare function App(): unknown;
declare function render(node: unknown): void;

<App />;
<div>content</div>;
<></>;
render(<App />);
`
  file := parseTSXFile(t, "/virtual/no-unused-expressions-jsx.tsx", source)
  findings := NewEngine(RuleConfig{"no-unused-expressions": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d (%+v)", len(findings), findings)
  }
}
