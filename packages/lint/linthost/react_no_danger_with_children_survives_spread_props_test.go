package linthost

import "testing"

// TestReactNoDangerWithChildrenSurvivesSpreadProps verifies react rules
// survive JSX spread attributes.
//
// The shared reactJSXAttrs helper used to cast every attribute-list member
// with AsJsxAttribute, so a `{...props}` member (a JsxSpreadAttribute)
// crashed element-scanning react rules with "interface conversion:
// ast.nodeData is *ast.JsxSpreadAttribute, not *ast.JsxAttribute" — the
// engine surfaced the recovered panic as a finding on real-world shadcn/ui
// components. Spread members are now skipped like the nextjs/solid helpers
// do.
//
// 1. Parse an element with a spread attribute and children.
// 2. Enable only `react/no-danger-with-children`.
// 3. Assert no diagnostic (neither a report nor a recovered panic).
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify spread attributes with normal children remain free of findings and panic diagnostics; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A JsxSpreadAttribute is not an explicit dangerouslySetInnerHTML attribute.
// @evidence contracts/testing.md#distinguishing-cases The spread payload and normal text exercise the narrowing boundary; explicit raw HTML plus children has a reported counterpart.
// @evidence contracts/testing.md#execution-ownership TestReactNoDangerWithChildrenSurvivesSpreadProps is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoDangerWithChildrenSurvivesSpreadProps(t *testing.T) {
  assertReactRuleSkips(t, "react/no-danger-with-children", `declare const props: object; const Component = () => <div {...props}>text</div>;`)
}
