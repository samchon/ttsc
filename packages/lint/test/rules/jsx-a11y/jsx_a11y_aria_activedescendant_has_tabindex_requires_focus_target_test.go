package linthost

import "testing"

// TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget verifies active descendants need focus.
//
// `aria-activedescendant` only works from a focused container, so the lint rule
// must connect the ARIA attribute to a sibling `tabIndex` attribute on the same tag.
//
// 1. Parse a div with aria-activedescendant and no tabIndex.
// 2. Enable only `jsx-a11y/aria-activedescendant-has-tabindex`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify active-descendant div lacks a focus target; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations tabIndex zero makes the controlling container focusable. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases A div naming aria-activedescendant without tabIndex reports; adding tabIndex={0} is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-activedescendant-has-tabindex", `const Component = () => <div aria-activedescendant="item-1" />;`, "tabIndex")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-activedescendant-has-tabindex", "declare const props: object; const Component = () => <div aria-activedescendant=\"item-1\" tabIndex={0} />;")
}
