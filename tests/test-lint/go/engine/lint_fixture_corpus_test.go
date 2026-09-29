package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "reflect"
  "regexp"
  "strconv"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestLintFixtureCorpus verifies the complete classified TypeScript corpus.
//
// Each fixture retains its options, filename, companions, real checker,
// rendered diagnostic order and failure semantics while sharing one Go process.
// Unexpected findings on companion files are failures.
//
// 1. Read the projects prepared by scripts/test-go-lint.cjs.
// 2. Resolve the real config and evaluate rules with their required checker.
// 3. Compare every finding's source file, rule, severity and line.
func TestLintFixtureCorpus(t *testing.T) {
  manifest := os.Getenv("TTSC_LINT_CORPUS_MANIFEST")
  if manifest == "" {
    t.Skip("the full fixture corpus is prepared by scripts/test-go-lint.cjs")
  }
  data, err := os.ReadFile(manifest)
  if err != nil {
    t.Fatal(err)
  }
  var cases []struct {
    RelativeFile string
    ProjectRoot  string
    SourcePath   string
    SourcePaths  []string
    Rules        map[string]any
    Expected     []struct {
      Rule, Severity string
      Line           int
    }
  }
  if err := json.Unmarshal(data, &cases); err != nil {
    t.Fatal(err)
  }
  if len(cases) == 0 {
    t.Fatal("empty lint fixture corpus")
  }
  ansi := regexp.MustCompile("\\x1b\\[[0-9;]*[A-Za-z]")
  banner := regexp.MustCompile("^(.+):([0-9]+):[0-9]+[[:space:]]+-[[:space:]]+(error|warning)[[:space:]]+TS[0-9]+:[[:space:]]*\\[([^\\]]+)\\][[:space:]]*.*$")
  for _, fixture := range cases {
    t.Run(fixture.RelativeFile, func(t *testing.T) {
      resolver, err := loadRules(lintManifest(t), fixture.ProjectRoot, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      engine := NewEngineWithResolver(resolver)
      if err := engine.ConfigError(); err != nil {
        t.Fatal(err)
      }
      engine.SetCurrentDirectory(fixture.ProjectRoot)
      var findings []*Finding
      if !engine.NeedsTypeChecker() && len(fixture.SourcePaths) == 1 {
        location := filepath.Join(fixture.ProjectRoot, fixture.SourcePath)
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
        project := &program{cwd: fixture.ProjectRoot}
        project.identity = normalizeProjectIdentity(project.identity, fixture.ProjectRoot, filepath.Join(fixture.ProjectRoot, "tsconfig.json"))
        findings = project.runCycleOver(engine, []*shimast.SourceFile{file})
      } else {
        project, _, err := loadProgram(fixture.ProjectRoot, "tsconfig.json", loadProgramOptions{
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
      errors := shimdw.FormatMixedDiagnostics(&rendered, nil, diagnostics, fixture.ProjectRoot)
      if errors == 0 {
        // Warning-only fixtures formerly failed because of TypeScript errors.
        // Preserve that exact command assertion, rather than treating warnings
        // as errors or relying on their count to predict the process status.
        var stdout, stderr bytes.Buffer
        status := RunCheckWithIO([]string{
          "--cwd", fixture.ProjectRoot,
          "--plugins-json", lintManifest(t), "--noEmit",
        }, &stdout, &stderr)
        if status == 0 {
          t.Errorf("fixture must fail check, got status 0:\n%s", stderr.String())
        }
        rendered = stderr
      }
      type diagnostic struct {
        File, Rule, Severity string
        Line                 int
      }
      actual := []diagnostic{}
      expected := []diagnostic{}
      output := ansi.ReplaceAllString(rendered.String(), "")
      for _, line := range strings.Split(output, "\n") {
        matched := banner.FindStringSubmatch(line)
        if matched == nil {
          continue
        }
        severity := "error"
        if matched[3] == "warning" {
          severity = "warn"
        }
        lineNumber, err := strconv.Atoi(matched[2])
        if err != nil {
          t.Fatal(err)
        }
        file := strings.ToLower(filepath.ToSlash(filepath.Clean(matched[1])))
        actual = append(actual, diagnostic{file, matched[4], severity, lineNumber})
      }
      for _, finding := range fixture.Expected {
        expected = append(expected, diagnostic{strings.ToLower(fixture.SourcePath), finding.Rule, finding.Severity, finding.Line})
      }
      if !reflect.DeepEqual(actual, expected) {
        t.Errorf("findings: got %+v; want %+v", actual, expected)
      }
    })
  }
}
