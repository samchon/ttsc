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
func TestReactNoDangerWithChildrenSurvivesSpreadProps(t *testing.T) {
  assertReactRuleSkips(t, "react/no-danger-with-children", `declare const props: object; const Component = () => <div {...props}>text</div>;`)
}
