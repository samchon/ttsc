package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "reflect"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// TestLintFixtureCorpus verifies the complete classified TypeScript corpus.
//
// Each fixture retains its options, filename, companions and real checker while
// sharing one Go process. Unexpected findings on companion files are failures.
//
// 1. Read the projects prepared by scripts/test-go-lint.cjs.
// 2. Run AST-only rules directly; load a program for checker/companion cases.
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
  for _, fixture := range cases {
    t.Run(fixture.RelativeFile, func(t *testing.T) {
      rules, options, err := ParseRulesWithOptions(fixture.Rules)
      if err != nil {
        t.Fatal(err)
      }
      engine := NewEngineWithResolver(InlineRuleResolver{Rules: rules, Options: options})
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
        program, _, err := loadProgram(fixture.ProjectRoot, "tsconfig.json", loadProgramOptions{
          forceNoEmit: true, needsRuleChecker: engine.NeedsTypeChecker(),
        })
        if program != nil {
          defer program.close()
        }
        if err != nil {
          t.Fatal(err)
        }
        if program == nil {
          t.Fatal("no program")
        }
        if engine.NeedsTypeChecker() && program.checker == nil {
          t.Fatal("no checker for a type-aware rule")
        }
        findings = program.runLintCycle(engine)
      }
      type diagnostic struct {
        File, Rule, Severity string
        Line                 int
      }
      actual := []diagnostic{}
      expected := []diagnostic{}
      for _, finding := range findings {
        file, err := filepath.Rel(fixture.ProjectRoot, finding.File.FileName())
        if err != nil {
          t.Fatal(err)
        }
        severity := "error"
        if finding.Severity == SeverityWarn {
          severity = "warn"
        }
        if finding.Severity != SeverityWarn && finding.Severity != SeverityError {
          t.Fatalf("unexpected finding severity %v", finding.Severity)
        }
        actual = append(actual, diagnostic{strings.ToLower(filepath.ToSlash(file)), finding.Rule, severity,
          shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1})
      }
      for _, finding := range fixture.Expected {
        expected = append(expected, diagnostic{strings.ToLower(fixture.SourcePath), finding.Rule, finding.Severity, finding.Line})
      }
      order := func(items []diagnostic) {
        sort.Slice(items, func(i, j int) bool {
          a, b := items[i], items[j]
          if a.File != b.File {
            return a.File < b.File
          }
          if a.Line != b.Line {
            return a.Line < b.Line
          }
          if a.Rule != b.Rule {
            return a.Rule < b.Rule
          }
          return a.Severity < b.Severity
        })
      }
      order(actual)
      order(expected)
      if !reflect.DeepEqual(actual, expected) {
        t.Errorf("findings: got %+v; want %+v", actual, expected)
      }
    })
  }
}
