package linthost

import "testing"

// TestReactVoidDOMElementsNoChildrenReportsImgChild verifies void DOM elements
// do not receive children.
//
// Void elements cannot render children, so the rule can stay intrinsic-element
// only and avoid component mapping.
//
// 1. Parse an img with text children.
// 2. Enable only `react/void-dom-elements-no-children`.
// 3. Assert the img opening element is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify text children on img report; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations HTML void elements cannot own child content; a self-closing img has none.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactVoidDOMElementsNoChildrenReportsImgChild is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactVoidDOMElementsNoChildrenReportsImgChild(t *testing.T) {
  assertReactRuleFinds(t, "react/void-dom-elements-no-children", `const C = () => <img>fallback</img>;`, "Void")
  assertReactRuleSkips(t, "react/void-dom-elements-no-children", "const C = () => <img />;")
}
