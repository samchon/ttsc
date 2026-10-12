package linthost

import (
  "bytes"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
  "strings"
  "testing"
)

// TestContributorDiagnosticRangesAreBounded verifies the public contributor
// trust boundary normalizes every explicit source span before inline
// directives, LSP conversion, or native diagnostic rendering can consume it.
//
//  1. Report six authored negative, reversed, beyond-end, EOF, empty and valid spans through the public adapter.
//  2. Require exact canonical bounds, unique original-message findings, nonnegative LSP positions and one native error render per source.
//
// @evidence contracts/testing.md#behavioral-verification Real adapted contributor reports normalize negative, reversed, beyond-end, EOF, empty and valid spans to authored bounds; each file appears once with its original message, LSP coordinates stay nonnegative and supported diagnostic rendering reports one error.
// @evidence contracts/testing.md#independent-expectations Literal 0..5, 8..9 and 6..11 bounds plus authored source lengths define canonical expectations independently of normalization. Original raw spans are separately supplied to the supported diagnostic writer for the same expected bounds.
// @evidence contracts/testing.md#distinguishing-cases Six distinct boundary sources include unchanged valid span and empty source; unique file tracking prevents duplicate findings from replacing missing cases, while rule/severity/failure guards exclude recovered panics.
// @evidence contracts/testing.md#execution-ownership Actual inspection, Register and Engine dispatch exercise the public adapter, then real LSP conversion and supported in-memory diagnostic rendering run in one Go process with registry cleanup; no native producer or installed host is claimed.
func TestContributorDiagnosticRangesAreBounded(t *testing.T) {
  files := []*shimast.SourceFile{
    parseTSFile(t, "/virtual/negative.ts", "const negative = 1;\n"),
    parseTSFile(t, "/virtual/reversed.ts", "const reversed = 1;\n"),
    parseTSFile(t, "/virtual/beyond.ts", "const beyond = 1;\n"),
    parseTSFile(t, "/virtual/eof.ts", "const eof = 1;\n"),
    parseTSFile(t, "/virtual/empty.ts", ""),
    parseTSFile(t, "/virtual/valid.ts", "const valid = 1;\n"),
  }
  contributor := &boundedDiagnosticRangeContributor{
    spans: map[string][2]int{
      files[0].FileName().AsString(): {-7, 5},
      files[1].FileName().AsString(): {8, 3},
      files[2].FileName().AsString(): {999, 1200},
      files[3].FileName().AsString(): {len(files[3].Text()), len(files[3].Text())},
      files[4].FileName().AsString(): {-4, 12},
      files[5].FileName().AsString(): {6, 11},
    },
  }
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  adapter := newContributorAdapter(metadata)
  Register(adapter)
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run(files, nil)
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, findings); err != nil {
    t.Fatal(err)
  }
  if got, want := len(findings), len(files); got != want {
    t.Fatalf("findings = %d, want %d: %+v", got, want, findings)
  }
  expected := map[string][2]int{
    files[0].FileName().AsString(): {0, 5},
    files[1].FileName().AsString(): {8, 9},
    files[2].FileName().AsString(): {len(files[2].Text()), len(files[2].Text())},
    files[3].FileName().AsString(): {len(files[3].Text()), len(files[3].Text())},
    files[4].FileName().AsString(): {0, 0},
    files[5].FileName().AsString(): {6, 11},
  }
  seen := map[string]bool{}
  for _, finding := range findings {
    want, ok := expected[finding.File.FileName().AsString()]
    if !ok {
      t.Fatalf("unexpected finding file: %+v", finding)
    }
    if seen[finding.File.FileName().AsString()] || finding.Message != "explicit contributor range" {
      t.Fatalf("duplicate file or lost contributor message: %+v", finding)
    }
    seen[finding.File.FileName().AsString()] = true
    if finding.Pos != want[0] || finding.End != want[1] {
      t.Fatalf("range for %s = [%d,%d), want [%d,%d)",
        finding.File.FileName(), finding.Pos, finding.End, want[0], want[1])
    }

    lspRange := lspRangeForFinding(finding)
    if lspRange.Start.Line < 0 || lspRange.Start.Character < 0 ||
      lspRange.End.Line < 0 || lspRange.End.Character < 0 {
      t.Fatalf("negative LSP range for %s: %+v", finding.File.FileName(), lspRange)
    }

    diagnostic := shimdw.NewLintDiagnostic(
      finding.File,
      contributor.spans[finding.File.FileName().AsString()][0],
      contributor.spans[finding.File.FileName().AsString()][1],
      9501,
      shimdw.LintCategoryError,
      "bounded contributor diagnostic",
    )
    if diagnostic.Pos() != want[0] || diagnostic.End() != want[1] {
      t.Fatalf("native range for %s = [%d,%d), want [%d,%d)",
        finding.File.FileName(), diagnostic.Pos(), diagnostic.End(), want[0], want[1])
    }
    var rendered bytes.Buffer
    if got := shimdw.FormatMixedDiagnostics(&rendered, nil, []*shimdw.LintDiagnostic{diagnostic}, "/virtual"); got != 1 {
      t.Fatalf("bounded error render count = %d, want 1", got)
    }
    if !strings.Contains(rendered.String(), "bounded contributor diagnostic") {
      t.Fatalf("native diagnostic was not rendered for %s: %q", finding.File.FileName(), rendered.String())
    }
  }
}

type boundedDiagnosticRangeContributor struct {
  spans   map[string][2]int
  fixFile string
}

func (*boundedDiagnosticRangeContributor) Name() string {
  return "test/bounded-diagnostic-range"
}
func (*boundedDiagnosticRangeContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r *boundedDiagnosticRangeContributor) Check(ctx *publicrule.Context, _ *shimast.Node) {
  span := r.spans[ctx.File.FileName().AsString()]
  if ctx.File.FileName().AsString() == r.fixFile {
    ctx.ReportRangeFix(span[0], span[1], "explicit contributor range", publicrule.TextEdit{
      Pos:  0,
      End:  5,
      Text: "let",
    })
    return
  }
  ctx.ReportRange(span[0], span[1], "explicit contributor range")
}

type boundedDiagnosticRangeHostRule struct{}

func (boundedDiagnosticRangeHostRule) Name() string { return "test/bounded-host-range" }
func (boundedDiagnosticRangeHostRule) Visits() []shimast.Kind {
  return nil
}
func (boundedDiagnosticRangeHostRule) Check(*Context, *shimast.Node) {}
