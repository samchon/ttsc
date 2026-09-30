package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthAbstainsInsideJsxExpression verifies the rule leaves a
// reflow node nested inside a JSX expression container (`{…}`) byte-identical,
// so `ttsc format` does not oscillate to the 10-pass cap on valid `.tsx`.
//
// A call / conditional that sits inside BOTH a JSX attribute initializer
// (`className={cond ? "a" : "b"}`) and a JSX child
// (`{items.map((i) => …)}`) gets broken by print-width, then the next pass
// measures each fragment flat, finds it fits, and reverts — formatting never
// converges and `ttsc format` exits 2. `KindJsxExpression` wraps both the
// attribute `{…}` and the child `{…}`, so a single `hasJsxExpressionAncestor`
// abstain (the JSX analogue of `hasTemplateSubstitutionAncestor`) covers both
// and breaks the oscillation. The case parses the repro as TSX, runs at a
// width that would otherwise break those nodes, and asserts zero findings.
//
//  1. Parse the oscillating `.tsx` repro under ScriptKindTSX.
//  2. Run format/print-width at printWidth=40 with the engine resolver.
//  3. Assert the rule emits zero findings — the JSX expressions stay intact.
// @evidence contracts/testing.md#behavioral-verification The engine parses the oscillating TSX repro and format/print-width must emit zero findings for its JSX expressions at width 40.
// @evidence contracts/testing.md#independent-expectations The authored JSX fixture and unsupported-expression preservation contract independently require abstention; the result is not compared with another printer pass.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: `KindJsxExpression` wraps both the attribute `{…}` and the child `{…}`, so a single `hasJsxExpressionAncestor` abstain (the JSX analogue of `hasTemplateSubstitutionAncestor`) covers both and breaks the oscillation. The case parses the repro as TSX, runs at a width that would otherwise break those nodes, and asserts zero findings. . The asserted decision is: Assert the rule emits zero findings — the JSX expressions stay intact. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsInsideJsxExpression owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestFormatPrintWidthAbstainsInsideJsxExpression(t *testing.T) {
  source := "const E = () => <div className={cond ? \"a\" : \"b\"}>{items.map((i) => <span>{i.name}</span>)}</div>;\n"
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.tsx")
  writeFile(t, filePath, source)
  file := parseTSXFile(t, filePath, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{"format/print-width": SeverityError},
    Options: RuleOptionsMap{"format/print-width": json.RawMessage(`{"printWidth": 40}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("format/print-width: expected zero findings, got %d (%+v)", len(findings), findings)
  }
}
