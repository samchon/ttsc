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
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies nonempty JSX text remains free of self-closing-comp findings; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Deleting real text would change the rendered child meaning, so this element is not empty.
// @evidence contracts/testing.md#distinguishing-cases This is the nonempty negative; TestSolidRenderingStylePreferences owns a truly empty element that must report.
// @evidence contracts/testing.md#execution-ownership TestSolidSelfClosingCompKeepsTextChildren owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
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
