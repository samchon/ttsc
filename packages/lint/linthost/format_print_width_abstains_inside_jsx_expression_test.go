package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatPrintWidthAbstainsInsideJsxExpression verifies the rule does not
// reflow targets inside JSX attribute and child expression containers.
// The original one-line TSX fixture and its no-finding assertion remain.
// A second fixture places the same over-budget call in both JSX positions;
// the ordinary-call positive distinguishes protected ancestry from a rule
// that never reflows. This body does not run a complete format cascade.
//
// 1. Parse the original conditional/map component as TSX at width 40.
// 2. Require no findings for calls in both JSX containers at width 20.
// 3. Require the same ordinary call to break into the authored output.
//
// @evidence contracts/testing.md#behavioral-verification The owning print-width rule must report no findings for the original conditional/map component or an encodeURIComponent call in each JSX container. The same call as an ordinary width-20 statement must break while retaining its callee and argument.
// @evidence contracts/testing.md#independent-expectations The supported JSX ownership policy excludes expression-container descendants from this dedicated rule. The ordinary-call literal separately follows the supported width and trailing-comma layout; no expected edit is calculated by an ancestor helper.
// @evidence contracts/testing.md#distinguishing-cases The original attribute conditional and child map stay. A second attribute/child pair contains the same over-budget call as the ordinary positive, preventing an always-silent rule from satisfying this host. No complete formatter pass sequence or exit status is asserted.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsInsideJsxExpression owns its original and added TSX parsed-source absence assertions and the ordinary-call snapshot in the public Go unit population. The syntax-only operations and disk-backed edit harness run in process without a built binary, consumer install or child process.
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
  protected := "const E = () => <div title={encodeURIComponent(value)}>{encodeURIComponent(value)}</div>;\n"
  resolver.Options["format/print-width"] = json.RawMessage(`{"printWidth":20}`)
  findings = NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{
    parseTSXFile(t, filepath.Join(root, "src", "protected.tsx"), protected),
  }, nil)
  if len(findings) != 0 {
    t.Fatalf("over-budget calls in JSX containers must remain excluded: %v", findings)
  }
  assertFixSnapshotWithOptions(t, "format/print-width", "encodeURIComponent(value);\n",
    `{"printWidth":20}`, "encodeURIComponent(\n  value,\n);\n")
}
