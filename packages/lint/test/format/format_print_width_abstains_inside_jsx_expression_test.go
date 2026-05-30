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
