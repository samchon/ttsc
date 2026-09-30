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
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, findings); err != nil { t.Fatal(err) }
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
  seen := map[string]bool{}
  for _, finding := range findings {
    want, ok := expected[finding.File.FileName()]
    if !ok {
      t.Fatalf("unexpected finding file: %+v", finding)
    }
    if seen[finding.File.FileName()] || finding.Message != "explicit contributor range" { t.Fatalf("duplicate file or lost contributor message: %+v", finding) }
    seen[finding.File.FileName()] = true
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
    if got := shimdw.FormatMixedDiagnostics(&rendered, nil, []*shimdw.LintDiagnostic{diagnostic}, "/virtual"); got != 1 { t.Fatalf("bounded error render count = %d, want 1", got) }
    if !strings.Contains(rendered.String(), "bounded contributor diagnostic") {
      t.Fatalf("native diagnostic was not rendered for %s: %q", finding.File.FileName(), rendered.String())
    }
  }
}

// TestInvalidContributorRangeCannotPanicInlineDirectiveFiltering pins the
// pre-render path: directive matching must receive the normalized EOF span,
// suppress it normally, and never pass an out-of-bounds offset to the scanner.
//
// @evidence contracts/testing.md#behavioral-verification Real adapted contributor beyond-end reports are suppressed by an authored eslint-disable directive without scanner panic; the same contributor without that directive reports one canonical EOF finding.
// @evidence contracts/testing.md#independent-expectations Literal zero findings for the disabled source and one original-message EOF finding for the independently authored control distinguish directive suppression from failed or inert dispatch.
// @evidence contracts/testing.md#distinguishing-cases Out-of-bounds 999..1200 spans exercise normalization before scanner filtering; directive-present versus absent sources share the same contributor identity, and the positive control rejects recovered execution failures.
// @evidence contracts/testing.md#execution-ownership Real inspected contributor registration and Engine.Run parse source directives directly in-process; cleanup removes registration and no native plugin artifact, CLI, install or repository-text inspection executes.
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
  plain := parseTSFile(t, "/virtual/directive.ts", "const value = 1;\n")
  control := NewEngine(RuleConfig{contributor.Name(): SeverityError}).Run([]*shimast.SourceFile{plain}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, control); err != nil { t.Fatal(err) }
  if len(control) != 1 || control[0].Pos != len(plain.Text()) || control[0].End != len(plain.Text()) || control[0].Message != "explicit contributor range" { t.Fatalf("same contributor without directive did not report bounded EOF: %+v", control) }
}

// TestContributorRangeFixBoundsDiagnosticIndependentlyFromEdit pins the
// public fix-reporting adapter. A malformed diagnostic span must be bounded
// without shifting or discarding an otherwise valid candidate edit; the two
// ranges have separate contracts and consumers.
//
// @evidence contracts/testing.md#behavioral-verification Real contributor public range-fix delegation bounds a malformed diagnostic at EOF while preserving the original message and complete candidate replacement edit 0..5 let.
// @evidence contracts/testing.md#independent-expectations Authored source length specifies the EOF diagnostic independently of the normalizer, while literal 0..5 let specifies a separate unchanged edit; neither expected coordinate is taken from the actual finding.
// @evidence contracts/testing.md#distinguishing-cases Malformed 999..-5 diagnostic bounds contrast with a valid replacement edit; exact cardinality, identity/severity guard and message prevent panic recovery or dropped candidate data from satisfying range checks.
// @evidence contracts/testing.md#execution-ownership Actual public contributor adapter and Engine dispatch execute directly in-process with registered contributor cleanup; the unit observes collected candidate data rather than executing a native producer or applying edits through an installed CLI.
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
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, findings); err != nil { t.Fatal(err) }
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
  if finding.Message != "explicit contributor range" { t.Fatalf("range-fix message changed: %q", finding.Message) }
}

// TestRangeSuggestionFindingUsesCanonicalBounds covers the internal
// suggestion-only reporting surface, which does not pass through the public
// contributor ReportRange method but feeds the same LSP diagnostic pipeline.
//
// @evidence contracts/testing.md#behavioral-verification Real internal range-suggestion collection canonicalizes a beyond-end/reversed diagnostic to EOF and retains its complete independent Keep the edit separate choice with one 0..5 let edit and original message.
// @evidence contracts/testing.md#independent-expectations Authored source length supplies the expected diagnostic EOF; literal title, message and candidate edit define the separately required suggestion payload independently of Context normalization.
// @evidence contracts/testing.md#distinguishing-cases Invalid diagnostic span and valid suggestion edit distinguish diagnostic clamping from candidate shifting or loss; collection must produce a real finding and exactly one complete choice.
// @evidence contracts/testing.md#execution-ownership The actual internal Context.ReportRangeSuggestion executes directly with an observing collect callback in-process; no public contributor adapter, native binary, install or edit application is asserted.
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
  choice := finding.Suggestions[0]
  if finding.Message != "bounded suggestion finding" || choice.Title != "Keep the edit separate" || len(choice.Edits) != 1 || choice.Edits[0] != (TextEdit{Pos: 0, End: 5, Text: "let"}) { t.Fatalf("bounded suggestion lost its independent edit or title: %+v", finding) }
}

// TestNodeReportBoundsBeforeSkippingTrivia proves a contributor cannot make
// the host slice the current source at another file's otherwise-valid node
// position. Normalization must happen before SkipTrivia, not only afterward.
//
// @evidence contracts/testing.md#behavioral-verification Real node reporting bounds a far-away parsed node from a different source at the current short source EOF before trivia scanning, retaining the current file and original message without panic.
// @evidence contracts/testing.md#independent-expectations Independently authored current x source length determines its EOF; the foreign node is asserted to lie beyond that source before reporting, so the test does not derive its expectation from the normalizer.
// @evidence contracts/testing.md#distinguishing-cases A genuine parsed foreign node contrasts with the valid current source and catches scanning before normalization; nonnil finding plus file identity and message distinguish successful bounded collection from inert reporting.
// @evidence contracts/testing.md#execution-ownership Actual internal Context.Report runs directly against two real parsed virtual sources with an observing collect callback in-process; no native producer, filesystem link, installation or foreign-source text check executes.
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
  if finding.File != current || finding.Message != "foreign node" { t.Fatalf("foreign node replaced the current diagnostic source or message: %+v", finding) }
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
