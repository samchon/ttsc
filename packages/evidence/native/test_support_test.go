package evidence

import (
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule"
)

type capturedProjectReporter struct {
  messages []string
  findings graphDiagnostics
  failed   bool
  state    any
}

func (reporter *capturedProjectReporter) Fail() {
  reporter.failed = true
}

func (reporter *capturedProjectReporter) Report(message string) {
  reporter.failed = true
  reporter.messages = append(reporter.messages, message)
}

func (reporter *capturedProjectReporter) ReportSeverity(severity rule.Severity, message string) {
  reporter.Report(message)
  reporter.findings = reporter.findings.add(severity, message)
}

func (reporter *capturedProjectReporter) SetState(state any) {
  reporter.state = state
}

// runGraphHints drives the graph rule and returns the corpus a consumer would
// actually receive, together with whatever the rule reported.
//
// The gate is reproduced here rather than bypassed. `linthost/hints.go:147-149`
// skips a rule whose snapshot is not `ProjectRulePassed` or whose state is nil,
// and `projectReporter.Report` marks a rule failed unconditionally
// (`linthost/project_engine.go:68-77`). Calling `Hints` directly would answer a
// question no editor asks — what the rule *could* publish — while the behavior
// under test is what an author sees, which is nothing on the cycle an
// obligation goes unmet.
func runGraphHints(
  t *testing.T,
  files map[string]string,
  config string,
) ([]rule.Hint, []string) {
  t.Helper()
  root := t.TempDir()
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    content := files[relative]
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
    if !isTypeScriptTestPath(relative) {
      continue
    }
    kind := shimcore.ScriptKindTS
    if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
      kind = shimcore.ScriptKindTSX
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      content,
      kind,
    ))
  }
  reporter := &capturedProjectReporter{}
  context := rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(config),
    reporter,
  )
  graphRule{}.Check(context)
  if reporter.failed || reporter.state == nil {
    return nil, reporter.messages
  }
  hints := graphRule{}.Hints(&rule.HintContext{
    Identity: rule.ProjectIdentity{PhysicalProjectRoot: root},
    State:    reporter.state,
    Severity: rule.SeverityError,
    Options:  json.RawMessage(config),
  })
  return hints, reporter.messages
}

// targetHintsAt narrows a corpus to one trigger, preserving published order.
func targetHintsAt(hints []rule.Hint, after string) []rule.Hint {
  narrowed := []rule.Hint{}
  for _, hint := range hints {
    if hint.Trigger.After == after {
      narrowed = append(narrowed, hint)
    }
  }
  return narrowed
}

// targetInserts lists what a corpus would insert, in offered order.
func targetInserts(hints []rule.Hint) []string {
  inserts := make([]string, 0, len(hints))
  for _, hint := range hints {
    inserts = append(inserts, hint.Insert)
  }
  return inserts
}

func runIndexRule(
  t *testing.T,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  return runIndexRuleAtRoot(t, t.TempDir(), files, config)
}

// runIndexRuleAtRoot drives the same project-rule path from a caller-owned
// root. Loader tests use a workspace-local root so the real Node bridge can
// resolve this package exactly as a consumer does; ordinary cases keep the
// isolated system temp root above.
func runIndexRuleAtRoot(
  t *testing.T,
  root string,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  return runIndexRuleAtSeverity(t, root, files, config, rule.SeverityError).messages
}

func runIndexRuleAtSeverity(t *testing.T, root string, files map[string]string, config string, severity rule.Severity) *capturedProjectReporter {
  t.Helper()
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    content := files[relative]
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
    if !isTypeScriptTestPath(relative) {
      continue
    }
    normalized := filepath.ToSlash(absolute)
    kind := shimcore.ScriptKindTS
    if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
      kind = shimcore.ScriptKindTSX
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: normalized},
      content,
      kind,
    ))
  }
  reporter := &capturedProjectReporter{}
  context := rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    severity,
    json.RawMessage(config),
    reporter,
  )
  graphRule{}.Check(context)
  sort.Strings(reporter.messages)
  return reporter
}

// capturedFileReporter records what a file rule reported.
//
// Both reporter interfaces are implemented together because Go interface
// satisfaction is all-or-nothing: a fake missing the fix half silently stops
// being a FixReporter, and the rule's findings would vanish from the capture.
type capturedFileReporter struct {
  messages []string
}

func (reporter *capturedFileReporter) Report(
  _ *shimast.Node,
  message string,
) {
  reporter.messages = append(reporter.messages, message)
}

func (reporter *capturedFileReporter) ReportRange(
  _ int,
  _ int,
  message string,
) {
  reporter.messages = append(reporter.messages, message)
}

func (reporter *capturedFileReporter) ReportFix(
  _ *shimast.Node,
  message string,
  _ ...rule.TextEdit,
) {
  reporter.messages = append(reporter.messages, message)
}

func (reporter *capturedFileReporter) ReportRangeFix(
  _ int,
  _ int,
  message string,
  _ ...rule.TextEdit,
) {
  reporter.messages = append(reporter.messages, message)
}

var _ rule.Reporter = &capturedFileReporter{}
var _ rule.FixReporter = &capturedFileReporter{}

func parseTestSourceFile(
  t *testing.T,
  path string,
  content string,
) *shimast.SourceFile {
  t.Helper()
  absolute := filepath.ToSlash(filepath.Join(t.TempDir(), filepath.FromSlash(path)))
  kind := shimcore.ScriptKindTS
  if strings.HasSuffix(strings.ToLower(path), ".tsx") {
    kind = shimcore.ScriptKindTSX
  }
  return shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: absolute},
    content,
    kind,
  )
}

func runSingularRule(t *testing.T, path string, content string) []string {
  t.Helper()
  file := parseTestSourceFile(t, path, content)
  reporter := &capturedFileReporter{}
  singularRule{}.Check(
    rule.NewContext(file, nil, rule.SeverityError, nil, reporter),
    file.AsNode(),
  )
  return reporter.messages
}

func runDocumentedRule(
  t *testing.T,
  path string,
  content string,
  options string,
) []string {
  t.Helper()
  file := parseTestSourceFile(t, path, content)
  reporter := &capturedFileReporter{}
  documentedRule{}.Check(
    rule.NewContext(
      file,
      nil,
      rule.SeverityError,
      json.RawMessage(options),
      reporter,
    ),
    file.AsNode(),
  )
  return reporter.messages
}

// runTodoRule drives the todo rule with no options, the only form the host
// ever delivers: the rule declares `AcceptsTtscLintOptions() false`, so a
// configured options object is refused at engine construction and Check never
// runs against one.
func runTodoRule(t *testing.T, path string, content string) []string {
  t.Helper()
  file := parseTestSourceFile(t, path, content)
  reporter := &capturedFileReporter{}
  todoRule{}.Check(
    rule.NewContext(file, nil, rule.SeverityError, nil, reporter),
    file.AsNode(),
  )
  return reporter.messages
}

// scanProjectMarkdown scans one document at the default population base.
//
// Every case predating `root` addressed a document by its project-relative
// path, which is exactly what the default base still produces — so the helper
// keeps those cases asserting the behavior they were written for rather than
// silently becoming cases about a rooted population.
func scanProjectMarkdown(
  path string,
  content string,
) (*artifactInventory, []string) {
  return scanMarkdownInventory(
    resolvePopulationBase("", "").addressOf(path),
    content,
  )
}

// anchoredGraph resolves a hand-built configuration the way Check does.
//
// A population reaches `materializeClaimStates` already anchored on the base its
// globs resolve against, so a literal that skipped this step would describe a
// configuration no consumer can produce — and would then match nothing, which
// reads exactly like a glob that selects nothing.
func anchoredGraph(root string, config graphConfig) graphConfig {
  resolveGraphBases(root, &config)
  return config
}

func assertSilent[T string | graphDiagnostic](t *testing.T, problems []T) {
  messages := problemMessages(problems)
  t.Helper()
  if len(messages) != 0 {
    t.Fatalf("expected no diagnostics, got:\n%s", strings.Join(messages, "\n"))
  }
}

func assertReportedAmong[T string | graphDiagnostic](t *testing.T, problems []T, expected string) {
  messages := problemMessages(problems)
  t.Helper()
  for _, message := range messages {
    if strings.Contains(message, expected) {
      return
    }
  }
  t.Fatalf(
    "expected one diagnostic containing %q, got:\n%s",
    expected,
    strings.Join(messages, "\n"),
  )
}

func assertReported[T string | graphDiagnostic](t *testing.T, problems []T, expected string) {
  messages := problemMessages(problems)
  t.Helper()
  if len(messages) != 1 {
    t.Fatalf(
      "expected exactly one diagnostic containing %q, got %d:\n%s",
      expected,
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
  if !strings.Contains(messages[0], expected) {
    t.Fatalf("expected diagnostic containing %q, got:\n%s", expected, messages[0])
  }
}

func isTypeScriptTestPath(path string) bool {
  path = strings.ToLower(path)
  for _, extension := range []string{".ts", ".tsx", ".mts", ".cts"} {
    if strings.HasSuffix(path, extension) {
      return true
    }
  }
  return false
}

func parseTypeScriptInventory(
  t *testing.T,
  path string,
  content string,
) *artifactInventory {
  t.Helper()
  absolute := filepath.ToSlash(filepath.Join(t.TempDir(), filepath.FromSlash(path)))
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: absolute},
    content,
    shimcore.ScriptKindTS,
  )
  return scanTypeScriptInventory(path, file)
}

func assertNoProblems[T string | graphDiagnostic](t *testing.T, problems []T) {
  messages := problemMessages(problems)
  t.Helper()
  if len(messages) != 0 {
    t.Fatalf("expected no evidence diagnostics, got:\n%s", strings.Join(messages, "\n"))
  }
}

func assertProblemContains[T string | graphDiagnostic](t *testing.T, problems []T, expected string) {
  messages := problemMessages(problems)
  t.Helper()
  for _, message := range messages {
    if strings.Contains(message, expected) {
      return
    }
  }
  t.Fatalf(
    "expected one evidence diagnostic containing %q, got:\n%s",
    expected,
    strings.Join(messages, "\n"),
  )
}

func countProblemsContaining[T string | graphDiagnostic](problems []T, expected string) int {
  messages := problemMessages(problems)
  count := 0
  for _, message := range messages {
    if strings.Contains(message, expected) {
      count++
    }
  }
  return count
}

// linkDirectory installs a directory the way a package manager does. A symlink
// needs a privilege Windows withholds by default, which is why pnpm uses a
// junction there; both are links a naive walker refuses to descend into, so
// either one exercises the case under test.
func linkDirectory(target string, link string) error {
  if err := os.Symlink(target, link); err == nil {
    return err
  } else if runtime.GOOS != "windows" {
    return err
  }
  return exec.Command(
    "cmd", "/c", "mklink", "/J",
    filepath.FromSlash(link), filepath.FromSlash(target),
  ).Run()
}

func problemMessages[T string | graphDiagnostic](problems []T) []string {
  messages := make([]string, 0, len(problems))
  for _, problem := range problems {
    switch value := any(problem).(type) {
    case string:
      messages = append(messages, value)
    case graphDiagnostic:
      messages = append(messages, value.Message)
    }
  }
  return messages
}
