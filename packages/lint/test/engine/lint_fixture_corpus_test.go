package linthost

import (
  "bytes"
  "fmt"
  "os"
  "path/filepath"
  "reflect"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestLintFixtureCorpus verifies the complete classified TypeScript corpus.
//
// Each fixture retains its options, filename, companions, real checker,
// rendered diagnostic order and failure semantics while sharing one Go process.
// Unexpected findings on companion files are failures, and a clean entry must
// draw no finding from its rule. A fixture whose exact finding sequence matches
// records its rules' behavioral witnesses.
//
// 1. Load and classify test/testdata/corpus, then materialize each positive or
//    clean entry as its own temporary project.
// 2. Resolve the real config and evaluate rules with their required checker.
// 3. Compare every finding's source file, rule, severity and line.
// 4. Record a behavioral witness for each rule of a fully matching fixture.
//
// @evidence contracts/testing.md#behavioral-verification Each materialized project reaches loadRules, the production engine cycle, the real checker when a rule needs one, and the production diagnostic renderer; every case compares the complete ordered source/rule/severity/line sequence, rejecting extra companion findings, and warning-only cases retain the real check failure assertion.
// @evidence contracts/testing.md#independent-expectations Expected findings come from the authored `// expect:` annotations of each fixture, resolved by the corpus loader's annotation parser; neither Engine nor its renderer generates the expected diagnostic sequence, and the loader's parsing is separately verified by its own cases.
// @evidence contracts/testing.md#distinguishing-cases Owns the classified non-skipped corpus, including options, renamed source files, TSX, companion inputs, checker-required rules and warning fixtures whose TypeScript errors must still fail check. The separate four-case command entry owns clean and warning-only success controls.
// @evidence contracts/testing.md#execution-ownership TestLintFixtureCorpus is the discoverable Go entry; dynamically named fixture subcases share one selected Go process and are not separately addressable Evidence declarations. Real config, program and renderer operations run in-process over disposable t.TempDir projects without per-fixture native compilation or child hosts; a corpus that cannot be loaded or classified fails the entry.
func TestLintFixtureCorpus(t *testing.T) {
  cases, err := loadLintCorpus(lintCorpusRoot)
  if err != nil {
    t.Fatal(err)
  }
  if len(cases) == 0 {
    t.Fatal("empty lint fixture corpus")
  }
  for _, fixture := range cases {
    t.Run(fixture.RelativeFile, func(t *testing.T) {
      projectRoot := t.TempDir()
      if err := materializeCorpusProject(projectRoot, fixture); err != nil {
        t.Fatal(err)
      }
      resolver, err := loadRules(lintManifest(t), projectRoot, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      engine := NewEngineWithResolver(resolver)
      if err := engine.ConfigError(); err != nil {
        t.Fatal(err)
      }
      if unknown := engine.UnknownRules(); len(unknown) != 0 {
        t.Fatalf("unknown corpus rule identities: %v", unknown)
      }
      engine.SetCurrentDirectory(projectRoot)
      var findings []*Finding
      if !engine.NeedsTypeChecker() && len(fixture.Companions) == 0 {
        location := filepath.Join(projectRoot, filepath.FromSlash(fixture.SourcePath))
        source, err := os.ReadFile(location)
        if err != nil {
          t.Fatal(err)
        }
        var file *shimast.SourceFile
        if strings.EqualFold(filepath.Ext(location), ".tsx") {
          file = parseTSXFile(t, location, string(source))
        } else {
          file = parseTSFile(t, location, string(source))
        }
        project := &program{cwd: projectRoot}
        project.identity = normalizeProjectIdentity(project.identity, projectRoot, filepath.Join(projectRoot, "tsconfig.json"))
        findings = project.runCycleOver(engine, []*shimast.SourceFile{file})
      } else {
        project, _, err := loadProgram(projectRoot, "tsconfig.json", loadProgramOptions{
          forceNoEmit: true, needsRuleChecker: engine.NeedsTypeChecker(),
        })
        if project != nil {
          defer project.close()
        }
        if err != nil {
          t.Fatal(err)
        }
        if project == nil {
          t.Fatal("no program")
        }
        if engine.NeedsTypeChecker() && project.checker == nil {
          t.Fatal("no checker for a type-aware rule")
        }
        findings = project.runLintCycle(engine)
      }
      expectedRules := RuleConfig{}
      for rule, entry := range fixture.Rules {
        severity := entry
        if tuple, ok := entry.([]any); ok {
          severity = tuple[0]
        }
        expectedRules[rule] = parseExpectedSeverity(t, severity.(string))
      }
      if err := validateSemanticRuleFindings(expectedRules, findings); err != nil {
        t.Fatalf("invalid semantic corpus findings: %v", err)
      }
      // Render every rule's findings through the production renderer. The
      // expected sequence remains in its annotated order; sorting it would
      // conceal a regression that the former command-based corpus rejected.
      var rendered bytes.Buffer
      diagnostics := make([]*shimdw.LintDiagnostic, 0, len(findings))
      for _, finding := range findings {
        category := shimdw.LintCategoryError
        if finding.Severity == SeverityWarn {
          category = shimdw.LintCategoryWarning
        } else if finding.Severity != SeverityError {
          t.Fatalf("unexpected finding severity %v", finding.Severity)
        }
        diagnostics = append(diagnostics, shimdw.NewLintDiagnostic(
          finding.File, finding.Pos, finding.End, ruleCode(finding.Rule),
          category, fmt.Sprintf("[%s] %s", finding.Rule, finding.Message),
        ))
      }
      errors := shimdw.FormatMixedDiagnostics(&rendered, nil, diagnostics, projectRoot)
      if len(findings) != 0 && errors == 0 {
        // Warning-only fixtures formerly failed because of TypeScript errors.
        // Preserve that exact command assertion, rather than treating warnings
        // as errors or relying on their count to predict the process status.
        var stdout, stderr bytes.Buffer
        status := RunCheckWithIO([]string{
          "--cwd", projectRoot,
          "--plugins-json", lintManifest(t), "--noEmit",
        }, &stdout, &stderr)
        if status == 0 {
          t.Errorf("fixture must fail check, got status 0:\n%s", stderr.String())
        }
        rendered = stderr
      }
      actual, err := parseCorpusDiagnostics(rendered.String())
      if err != nil {
        t.Fatal(err)
      }
      expected := expectedCorpusDiagnostics(fixture)
      if !reflect.DeepEqual(actual, expected) {
        t.Errorf("findings: got %+v; want %+v", actual, expected)
      }
      if t.Failed() {
        return
      }
      // Only a fixture whose complete expected sequence was observed witnesses
      // its rules, under the prerequisite its own directives require.
      recorded := map[string]bool{}
      for _, expectation := range fixture.Expected {
        if recorded[expectation.Rule] {
          continue
        }
        recorded[expectation.Rule] = true
        kind := behavioralWitnessKindForRule(expectation.Rule)
        if fixture.Options[expectation.Rule] {
          kind = behavioralWitnessOptions
        } else if fixture.Renamed {
          kind = behavioralWitnessFilename
        }
        recordBehavioralWitness(t, expectation.Rule, kind)
      }
    })
  }
}
