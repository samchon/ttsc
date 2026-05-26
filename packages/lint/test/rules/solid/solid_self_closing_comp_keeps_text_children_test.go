package linthost

import "testing"

/**
 * Verifies solid self-closing-comp: JSX text children make an element non-empty.
 *
 * Locks the source-text branch for `JsxText` children. The rule must ignore
 * whitespace-only JSX text, but a real text node keeps `<div>text</div>` from
 * being rewritten as an empty element.
 *
 * 1. Import Solid so the Solid rule family is active.
 * 2. Return a DOM element with a non-empty JSX text child.
 * 3. Assert `solid/self-closing-comp` reports no findings.
 */
func TestSolidSelfClosingCompKeepsTextChildren(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  createSignal(0);
  return <div>ready</div>;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/self-closing-comp": SeverityError,
  }, nil)
}
