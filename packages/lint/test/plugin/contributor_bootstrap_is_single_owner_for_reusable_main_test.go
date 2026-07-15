package linthost

import (
  "fmt"
  "os"
  "strings"
  "sync"
  "sync/atomic"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type bootstrapFileRuleCounts struct {
  name                  atomic.Int32
  visits                atomic.Int32
  isFormat              atomic.Int32
  visitsDeclarationFile atomic.Int32
  acceptsOptions        atomic.Int32
}

type bootstrapCountingFileRule struct {
  name   string
  counts bootstrapFileRuleCounts
}

func (r *bootstrapCountingFileRule) Name() string {
  r.counts.name.Add(1)
  return r.name
}
func (r *bootstrapCountingFileRule) Visits() []shimast.Kind {
  r.counts.visits.Add(1)
  return []shimast.Kind{shimast.KindSourceFile}
}
func (*bootstrapCountingFileRule) Check(*publicrule.Context, *shimast.Node) {}
func (r *bootstrapCountingFileRule) AcceptsTtscLintOptions() bool {
  r.counts.acceptsOptions.Add(1)
  return true
}

type bootstrapPanickingFileRule struct {
  method string
  counts bootstrapFileRuleCounts
}

func (r *bootstrapPanickingFileRule) Name() string {
  r.counts.name.Add(1)
  if r.method == "Name" {
    panic("bootstrap Name boom")
  }
  return "test/bootstrap-metadata-panic-" + strings.ToLower(r.method)
}
func (r *bootstrapPanickingFileRule) Visits() []shimast.Kind {
  r.counts.visits.Add(1)
  if r.method == "Visits" {
    panic("bootstrap Visits boom")
  }
  return []shimast.Kind{shimast.KindSourceFile}
}
func (*bootstrapPanickingFileRule) Check(*publicrule.Context, *shimast.Node) {}
func (r *bootstrapPanickingFileRule) IsFormat() bool {
  r.counts.isFormat.Add(1)
  if r.method == "IsFormat" {
    panic("bootstrap IsFormat boom")
  }
  return false
}
func (r *bootstrapPanickingFileRule) VisitsDeclarationFiles() bool {
  r.counts.visitsDeclarationFile.Add(1)
  if r.method == "VisitsDeclarationFiles" {
    panic("bootstrap VisitsDeclarationFiles boom")
  }
  return true
}
func (r *bootstrapPanickingFileRule) AcceptsTtscLintOptions() bool {
  r.counts.acceptsOptions.Add(1)
  if r.method == "AcceptsTtscLintOptions" {
    panic("bootstrap AcceptsTtscLintOptions boom")
  }
  return true
}

type bootstrapProjectRuleCounts struct {
  name           atomic.Int32
  acceptsOptions atomic.Int32
}

type bootstrapCountingProjectRule struct {
  name   string
  counts bootstrapProjectRuleCounts
}

func (r *bootstrapCountingProjectRule) Name() string {
  r.counts.name.Add(1)
  return r.name
}
func (*bootstrapCountingProjectRule) Check(*publicrule.ProjectContext) {}
func (r *bootstrapCountingProjectRule) AcceptsTtscLintOptions() bool {
  r.counts.acceptsOptions.Add(1)
  return true
}

type bootstrapPanickingProjectRule struct {
  method string
  counts bootstrapProjectRuleCounts
}

func (r *bootstrapPanickingProjectRule) Name() string {
  r.counts.name.Add(1)
  if r.method == "Name" {
    panic("bootstrap project Name boom")
  }
  return "test/bootstrap-project-metadata-panic-" + strings.ToLower(r.method)
}
func (*bootstrapPanickingProjectRule) Check(*publicrule.ProjectContext) {}
func (r *bootstrapPanickingProjectRule) AcceptsTtscLintOptions() bool {
  r.counts.acceptsOptions.Add(1)
  if r.method == "AcceptsTtscLintOptions" {
    panic("bootstrap project AcceptsTtscLintOptions boom")
  }
  return true
}

var bootstrapFileRules = []*bootstrapCountingFileRule{
  {name: "test/bootstrap-file-file"},
  {name: "test/bootstrap-file-file"},
  {name: "test/bootstrap-file-project"},
}

var bootstrapPanickingFileRules = []*bootstrapPanickingFileRule{
  {method: "Name"},
  {method: "Visits"},
  {method: "IsFormat"},
  {method: "VisitsDeclarationFiles"},
  {method: "AcceptsTtscLintOptions"},
}

var bootstrapProjectRules = []*bootstrapCountingProjectRule{
  {name: "test/bootstrap-project-project"},
  {name: "test/bootstrap-project-project"},
  {name: "test/bootstrap-file-project"},
}

var bootstrapPanickingProjectRules = []*bootstrapPanickingProjectRule{
  {method: "Name"},
  {method: "AcceptsTtscLintOptions"},
}

func init() {
  for _, fileRule := range bootstrapFileRules {
    publicrule.Register(fileRule)
  }
  for _, fileRule := range bootstrapPanickingFileRules {
    publicrule.Register(fileRule)
  }
  for _, projectRule := range bootstrapProjectRules {
    publicrule.RegisterProject(projectRule)
  }
  for _, projectRule := range bootstrapPanickingProjectRules {
    publicrule.RegisterProject(projectRule)
  }
}

// TestMain exercises the only fresh-process bootstrap before ordinary tests
// reuse Main. The init-time contributors above deliberately cover every
// collision class and metadata panic boundary; racing real entry calls proves
// one owner inspects them and publishes the immutable registries to all peers.
//
//  1. Release concurrent Main calls against the uninitialized host.
//  2. Assert every initial collision/panic warning appears exactly once and
//     every metadata method was evaluated by one bootstrap owner.
//  3. Reuse two different Main commands sequentially without another warning,
//     then run the ordinary package suite against the initialized host.
func TestMain(m *testing.M) {
  if err := verifyInitialContributorBootstrap(); err != nil {
    fmt.Fprintf(os.Stderr, "contributor bootstrap lifecycle: %v\n", err)
    os.Exit(1)
  }
  code := m.Run()
  if code == 0 && shouldVerifyRecordedBehavioralWitnessCoverage() {
    if err := verifyRecordedBehavioralWitnessCoverage(); err != nil {
      fmt.Fprintln(os.Stderr, err)
      code = 1
    }
  }
  os.Exit(code)
}

func verifyInitialContributorBootstrap() error {
  const concurrentCalls = 16
  commands := make([][]string, concurrentCalls)
  for index := range commands {
    if index%2 == 0 {
      commands[index] = []string{"lsp-command-ids"}
    } else {
      commands[index] = []string{"lsp-code-action-kinds"}
    }
  }
  codes, stderr, err := captureBootstrapMainCommands(commands)
  if err != nil {
    return err
  }
  for index, code := range codes {
    if code != 0 {
      return fmt.Errorf("concurrent Main call %d returned %d", index, code)
    }
  }

  expectedWarnings := []string{
    "metadata panicked: bootstrap Name boom; dropping contributor entry",
    "metadata panicked: bootstrap Visits boom; dropping contributor entry",
    "metadata panicked: bootstrap IsFormat boom; dropping contributor entry",
    "metadata panicked: bootstrap VisitsDeclarationFiles boom; dropping contributor entry",
    "metadata panicked: bootstrap AcceptsTtscLintOptions boom; dropping contributor entry",
    `contributor rule "test/bootstrap-file-file" collides with an existing rule; dropping contributor entry`,
    "metadata panicked: bootstrap project Name boom; dropping project contributor entry",
    "metadata panicked: bootstrap project AcceptsTtscLintOptions boom; dropping project contributor entry",
    `contributor project rule "test/bootstrap-file-project" collides with a file rule; dropping project contributor entry`,
    `contributor project rule "test/bootstrap-project-project" collides with an existing project rule; dropping contributor entry`,
  }
  normalized := strings.ReplaceAll(strings.TrimSpace(stderr), "\r\n", "\n")
  lines := strings.Split(normalized, "\n")
  if len(lines) != len(expectedWarnings) {
    return fmt.Errorf("initial warning count = %d, want %d: %q", len(lines), len(expectedWarnings), stderr)
  }
  for _, warning := range expectedWarnings {
    if count := strings.Count(stderr, warning); count != 1 {
      return fmt.Errorf("warning %q appeared %d times in %q", warning, count, stderr)
    }
  }
  if err := verifyContributorMetadataCounts(); err != nil {
    return err
  }
  if err := verifyContributorCollisionSurvivors(); err != nil {
    return err
  }

  for _, command := range [][]string{{"lsp-command-ids"}, {"lsp-code-action-kinds"}} {
    codes, stderr, err := captureBootstrapMainCommands([][]string{command})
    if err != nil {
      return err
    }
    if codes[0] != 0 || stderr != "" {
      return fmt.Errorf("reused Main(%q): code=%d stderr=%q", command[0], codes[0], stderr)
    }
  }
  return nil
}

func verifyContributorMetadataCounts() error {
  for index, fileRule := range bootstrapFileRules {
    if names, visits, options := fileRule.counts.name.Load(), fileRule.counts.visits.Load(), fileRule.counts.acceptsOptions.Load(); names != 1 || visits != 1 || options != 1 {
      return fmt.Errorf("file contributor %d metadata calls: Name=%d Visits=%d AcceptsTtscLintOptions=%d, want 1 each", index, names, visits, options)
    }
  }
  expectedPanics := []struct {
    name                  int32
    visits                int32
    isFormat              int32
    visitsDeclarationFile int32
    acceptsOptions        int32
  }{
    {name: 1},
    {name: 1, visits: 1},
    {name: 1, visits: 1, isFormat: 1},
    {name: 1, visits: 1, isFormat: 1, visitsDeclarationFile: 1},
    {name: 1, visits: 1, isFormat: 1, visitsDeclarationFile: 1, acceptsOptions: 1},
  }
  for index, fileRule := range bootstrapPanickingFileRules {
    expected := expectedPanics[index]
    actual := &fileRule.counts
    if actual.name.Load() != expected.name ||
      actual.visits.Load() != expected.visits ||
      actual.isFormat.Load() != expected.isFormat ||
      actual.visitsDeclarationFile.Load() != expected.visitsDeclarationFile ||
      actual.acceptsOptions.Load() != expected.acceptsOptions {
      return fmt.Errorf(
        "panicking file contributor %d metadata calls = (%d,%d,%d,%d,%d), want (%d,%d,%d,%d,%d)",
        index,
        actual.name.Load(),
        actual.visits.Load(),
        actual.isFormat.Load(),
        actual.visitsDeclarationFile.Load(),
        actual.acceptsOptions.Load(),
        expected.name,
        expected.visits,
        expected.isFormat,
        expected.visitsDeclarationFile,
        expected.acceptsOptions,
      )
    }
  }
  for index, projectRule := range bootstrapProjectRules {
    if names, options := projectRule.counts.name.Load(), projectRule.counts.acceptsOptions.Load(); names != 1 || options != 1 {
      return fmt.Errorf("project contributor %d metadata calls: Name=%d AcceptsTtscLintOptions=%d, want 1 each", index, names, options)
    }
  }
  expectedProjectPanics := []struct {
    name           int32
    acceptsOptions int32
  }{
    {name: 1},
    {name: 1, acceptsOptions: 1},
  }
  for index, projectRule := range bootstrapPanickingProjectRules {
    expected := expectedProjectPanics[index]
    if projectRule.counts.name.Load() != expected.name ||
      projectRule.counts.acceptsOptions.Load() != expected.acceptsOptions {
      return fmt.Errorf(
        "panicking project contributor %d metadata calls = (%d,%d), want (%d,%d)",
        index,
        projectRule.counts.name.Load(),
        projectRule.counts.acceptsOptions.Load(),
        expected.name,
        expected.acceptsOptions,
      )
    }
  }
  return nil
}

func verifyContributorCollisionSurvivors() error {
  fileFile, ok := registered.rules["test/bootstrap-file-file"].(contributorAdapter)
  if !ok || fileFile.inner != bootstrapFileRules[0] {
    return fmt.Errorf("file/file collision did not preserve the first contributor: %#v", registered.rules["test/bootstrap-file-file"])
  }

  fileProject, ok := registered.rules["test/bootstrap-file-project"].(contributorAdapter)
  if !ok || fileProject.inner != bootstrapFileRules[2] {
    return fmt.Errorf("file/project collision did not preserve the file contributor: %#v", registered.rules["test/bootstrap-file-project"])
  }
  if _, exists := registeredProjectRules["test/bootstrap-file-project"]; exists {
    return fmt.Errorf("file/project collision also installed the project contributor")
  }

  projectProject, ok := registeredProjectRules["test/bootstrap-project-project"]
  if !ok || projectProject.inner != bootstrapProjectRules[0] {
    return fmt.Errorf("project/project collision did not preserve the first contributor: %#v", projectProject)
  }
  return nil
}

func captureBootstrapMainCommands(commands [][]string) ([]int, string, error) {
  stdout, err := os.CreateTemp("", "ttsc-bootstrap-stdout-*")
  if err != nil {
    return nil, "", err
  }
  stdoutName := stdout.Name()
  defer os.Remove(stdoutName)
  stderr, err := os.CreateTemp("", "ttsc-bootstrap-stderr-*")
  if err != nil {
    _ = stdout.Close()
    return nil, "", err
  }
  stderrName := stderr.Name()
  defer os.Remove(stderrName)

  previousStdout, previousStderr := os.Stdout, os.Stderr
  os.Stdout, os.Stderr = stdout, stderr
  codes := make([]int, len(commands))
  start := make(chan struct{})
  var wait sync.WaitGroup
  wait.Add(len(commands))
  for index, command := range commands {
    go func() {
      defer wait.Done()
      <-start
      codes[index] = Main(command)
    }()
  }
  close(start)
  wait.Wait()
  os.Stdout, os.Stderr = previousStdout, previousStderr

  if err := stdout.Close(); err != nil {
    _ = stderr.Close()
    return nil, "", err
  }
  if err := stderr.Close(); err != nil {
    return nil, "", err
  }
  content, err := os.ReadFile(stderrName)
  if err != nil {
    return nil, "", err
  }
  return codes, string(content), nil
}

// TestContributorBootstrapIsSingleOwnerForReusableMain verifies commands keep
// reusing the registry state established by the fresh-process race above.
//
// The initial bootstrap already asserted collision and panic behavior. This
// guard keeps the public sequential-host contract explicit: distinct valid
// Main calls must not reinterpret the same init-time contributor declarations.
//
//  1. Invoke the command-id entry after bootstrap.
//  2. Invoke the code-action-kind entry in the same process.
//  3. Assert both succeed without contributor stderr.
func TestContributorBootstrapIsSingleOwnerForReusableMain(t *testing.T) {
  for _, command := range [][]string{{"lsp-command-ids"}, {"lsp-code-action-kinds"}} {
    code, _, stderr := captureCommandOutput(t, func() int { return Main(command) })
    if code != 0 || stderr != "" {
      t.Fatalf("Main(%q): code=%d stderr=%q", command[0], code, stderr)
    }
  }
}
