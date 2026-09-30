package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestJsxA11yRulesSurviveSpreadAttributes verifies no jsx-a11y rule panics or
// misfires on JSX spread attributes.
//
// The shared jsxAttrs helper used to cast every attribute-list member with
// AsJsxAttribute, so a `{...props}` member (a JsxSpreadAttribute) crashed
// every jsx-a11y element rule with "interface conversion: ast.nodeData is
// *ast.JsxSpreadAttribute, not *ast.JsxAttribute" — the engine surfaced the
// recovered panic as a finding on real-world shadcn/ui components. A spread
// also means the prop set is unknown, so absence-predicated rules must not
// report either. Running the whole family here seals the class instead of
// pinning one rule.
//
//  1. Parse a component whose elements all carry `{...props}`, mirroring the
//     shadcn/ui `<Comp {...props} />` repro.
//  2. Enable every registered `jsx-a11y/*` rule.
//  3. Assert zero findings: no recovered-panic findings and no
//     missing-attribute reports.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify all enabled accessibility rules report zero findings over eleven spread-bearing JSX element shapes; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations The supported conservative absence policy cannot prove missing properties across unknown spreads; explicit violating properties have separate reported tests. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Whole-family mixed img/anchor/html/frame/video/button/image-input/label/switch/click/heading shapes detect recovered-panic findings as well as missing-attribute overreports.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRulesSurviveSpreadAttributes owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRulesSurviveSpreadAttributes(t *testing.T) {
  source := `declare const props: Record<string, unknown>;
export const Component = () => (
  <div>
    <img {...props} />
    <a {...props}>documentation</a>
    <html {...props} />
    <iframe {...props} />
    <video {...props} />
    <button {...props} />
    <input type="image" {...props} />
    <label {...props}>Name</label>
    <span role="switch" {...props} />
    <span onClick={() => undefined} {...props} />
    <h1 {...props}></h1>
  </div>
);`
  config := RuleConfig{}
  for _, name := range AllRuleNames() {
    if strings.HasPrefix(name, "jsx-a11y/") {
      config[name] = SeverityError
    }
  }
  file := parseTSXFile(t, "/virtual/component.tsx", source)
  findings := NewEngine(config).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings on spread-attribute JSX, got %d: %+v", len(findings), findings)
  }
}
