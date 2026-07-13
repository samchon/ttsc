package linthost

import "testing"

// TestNoFallthroughCommandPreservesJSXCodePathBoundaries verifies JSX tag and
// attribute names remain syntax-only while embedded and spread expressions
// retain ordinary reference edges. This mirrors ESTree's JSXIdentifier and
// JSXMemberExpression boundary through the real TSX check command.
//
// 1. Return intrinsic and member JSX elements with syntax-only names.
// 2. Pair literal attributes with embedded and spread identifier expressions.
// 3. Assert only evaluated JSX expressions can make the catch reachable.
func TestNoFallthroughCommandPreservesJSXCodePathBoundaries(t *testing.T) {
  assertNoFallthroughCommandMarkersForFile(t, "main.tsx", `declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: Record<string, unknown>;
  }
}
declare namespace UI {
  function Component(properties: Record<string, unknown>): JSX.Element;
}
declare const identifier: string;
declare const properties: Record<string, unknown>;

function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        return <div />;
      } catch {}
    case 1:
      break;
    case 2:
      try {
        return <div title="literal" />;
      } catch {}
    case 3:
      break;
    case 4:
      try {
        return <UI.Component />;
      } catch {}
    case 5:
      break;
    case 6:
      try {
        return <div title={identifier} />;
      } catch {}
    case 7: // diagnostic
      break;
    case 8:
      try {
        return <div {...properties} />;
      } catch {}
    case 9: // diagnostic
      break;
  }
}

inspect(0);
`)
}
