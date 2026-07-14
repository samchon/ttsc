package linthost

import (
  "bytes"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorDiagnosticRangesAreBounded verifies the public contributor
// trust boundary normalizes every explicit source span before inline
// directives, LSP conversion, or native diagnostic rendering can consume it.
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
      files[0].FileName(): {-7, 5},
      files[1].FileName(): {8, 3},
      files[2].FileName(): {999, 1200},
      files[3].FileName(): {len(files[3].Text()), len(files[3].Text())},
      files[4].FileName(): {-4, 12},
      files[5].FileName(): {6, 11},
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
  if got, want := len(findings), len(files); got != want {
    t.Fatalf("findings = %d, want %d: %+v", got, want, findings)
  }
  expected := map[string][2]int{
    files[0].FileName(): {0, 5},
    files[1].FileName(): {8, 9},
    files[2].FileName(): {len(files[2].Text()), len(files[2].Text())},
    files[3].FileName(): {len(files[3].Text()), len(files[3].Text())},
    files[4].FileName(): {0, 0},
    files[5].FileName(): {6, 11},
  }
  for _, finding := range findings {
    want, ok := expected[finding.File.FileName()]
    if !ok {
      t.Fatalf("unexpected finding file: %+v", finding)
    }
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
      contributor.spans[finding.File.FileName()][0],
      contributor.spans[finding.File.FileName()][1],
      9501,
      shimdw.LintCategoryError,
      "bounded contributor diagnostic",
    )
    if diagnostic.Pos() != want[0] || diagnostic.End() != want[1] {
      t.Fatalf("native range for %s = [%d,%d), want [%d,%d)",
        finding.File.FileName(), diagnostic.Pos(), diagnostic.End(), want[0], want[1])
    }
    var rendered bytes.Buffer
    shimdw.FormatMixedDiagnostics(&rendered, nil, []*shimdw.LintDiagnostic{diagnostic}, "/virtual")
    if !strings.Contains(rendered.String(), "bounded contributor diagnostic") {
      t.Fatalf("native diagnostic was not rendered for %s: %q", finding.File.FileName(), rendered.String())
    }
  }
}

// TestInvalidContributorRangeCannotPanicInlineDirectiveFiltering pins the
// pre-render path: directive matching must receive the normalized EOF span,
// suppress it normally, and never pass an out-of-bounds offset to the scanner.
func TestInvalidContributorRangeCannotPanicInlineDirectiveFiltering(t *testing.T) {
  file := parseTSFile(t, "/virtual/directive.ts", `// eslint-disable test/bounded-diagnostic-range
const value = 1;
`)
  contributor := &boundedDiagnosticRangeContributor{
    spans: map[string][2]int{file.FileName(): {999, 1200}},
  }
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  Register(newContributorAdapter(metadata))
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("normalized EOF finding should be inline-disabled, got %+v", findings)
  }
}

// TestContributorRangeFixBoundsDiagnosticIndependentlyFromEdit pins the
// public fix-reporting adapter. A malformed diagnostic span must be bounded
// without shifting or discarding an otherwise valid candidate edit; the two
// ranges have separate contracts and consumers.
func TestContributorRangeFixBoundsDiagnosticIndependentlyFromEdit(t *testing.T) {
  file := parseTSFile(t, "/virtual/range-fix.ts", "const value = 1;\n")
  contributor := &boundedDiagnosticRangeContributor{
    spans:   map[string][2]int{file.FileName(): {999, -5}},
    fixFile: file.FileName(),
  }
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  Register(newContributorAdapter(metadata))
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got, want := len(findings), 1; got != want {
    t.Fatalf("findings = %d, want %d: %+v", got, want, findings)
  }
  finding := findings[0]
  sourceLen := len(file.Text())
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{sourceLen, sourceLen}; got != want {
    t.Fatalf("diagnostic range = %v, want EOF %v", got, want)
  }
  if got, want := finding.Fix, []TextEdit{{Pos: 0, End: 5, Text: "let"}}; len(got) != len(want) || got[0] != want[0] {
    t.Fatalf("candidate edit = %+v, want %+v", got, want)
  }
}

// TestRangeSuggestionFindingUsesCanonicalBounds covers the internal
// suggestion-only reporting surface, which does not pass through the public
// contributor ReportRange method but feeds the same LSP diagnostic pipeline.
func TestRangeSuggestionFindingUsesCanonicalBounds(t *testing.T) {
  file := parseTSFile(t, "/virtual/suggestion.ts", "const value = 1;\n")
  var finding *Finding
  ctx := &Context{
    File:     file,
    Severity: SeverityError,
    rule:     boundedDiagnosticRangeHostRule{},
    collect:  func(got *Finding) { finding = got },
  }
  ctx.ReportRangeSuggestion(
    len(file.Text())+20,
    -5,
    "bounded suggestion finding",
    "Keep the edit separate",
    TextEdit{Pos: 0, End: 5, Text: "let"},
  )
  if finding == nil {
    t.Fatal("range suggestion was not reported")
  }
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{len(file.Text()), len(file.Text())}; got != want {
    t.Fatalf("suggestion finding range = %v, want %v", got, want)
  }
  if got, want := len(finding.Suggestions), 1; got != want {
    t.Fatalf("suggestions = %d, want %d: %+v", got, want, finding.Suggestions)
  }
}

// TestNodeReportBoundsBeforeSkippingTrivia proves a contributor cannot make
// the host slice the current source at another file's otherwise-valid node
// position. Normalization must happen before SkipTrivia, not only afterward.
func TestNodeReportBoundsBeforeSkippingTrivia(t *testing.T) {
  current := parseTSFile(t, "/virtual/current.ts", "x;\n")
  foreign := parseTSFile(t, "/virtual/foreign.ts", strings.Repeat("const padding = 0;\n", 8)+"target;\n")
  foreignNode := foreign.Statements.Nodes[len(foreign.Statements.Nodes)-1]
  if foreignNode.Pos() <= len(current.Text()) {
    t.Fatalf("fixture node position %d must exceed current source length %d", foreignNode.Pos(), len(current.Text()))
  }

  var finding *Finding
  ctx := &Context{
    File:     current,
    Severity: SeverityError,
    rule:     boundedDiagnosticRangeHostRule{},
    collect:  func(got *Finding) { finding = got },
  }
  ctx.Report(foreignNode, "foreign node")
  if finding == nil {
    t.Fatal("foreign node diagnostic was not reported")
  }
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{len(current.Text()), len(current.Text())}; got != want {
    t.Fatalf("foreign node range = %v, want EOF %v", got, want)
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
  span := r.spans[ctx.File.FileName()]
  if ctx.File.FileName() == r.fixFile {
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
