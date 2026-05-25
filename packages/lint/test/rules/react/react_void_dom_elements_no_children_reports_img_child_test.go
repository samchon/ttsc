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
func TestReactVoidDOMElementsNoChildrenReportsImgChild(t *testing.T) {
	assertReactRuleFinds(t, "react/void-dom-elements-no-children", `const C = () => <img>fallback</img>;`, "Void")
}
