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
