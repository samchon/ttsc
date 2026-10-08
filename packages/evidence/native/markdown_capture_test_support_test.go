package evidence

import (
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "io/fs"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// markdownCaptureReader observes the public input seam without replacing a
// foreign reader. Native operations provide ordinary fixture results; explicit
// read failures and post-consumption hooks model the transitions a case owns.
// Witnesses record returned bytes, never a later filesystem read.
type markdownCaptureReader struct {
  reads map[string]int
  hashes map[string]string
  failures map[string]error
  walkFailures map[string]error
  entryFailures map[string]error
  stats map[string]int
  afterRead func(string)
  afterWalk func()
  walks []string
  unavailable bool
}

func (reader *markdownCaptureReader) ReadFile(name string) ([]byte, error) {
  if reader.reads == nil { reader.reads = map[string]int{} }
  if reader.hashes == nil { reader.hashes = map[string]string{} }
  reader.reads[name]++
  if err := reader.failures[name]; err != nil {
    reader.Unavailable()
    if reader.afterRead != nil { reader.afterRead(name) }
    return nil, err
  }
  content, err := os.ReadFile(name)
  if err == nil {
    digest := sha256.Sum256(content)
    reader.hashes[name] = hex.EncodeToString(digest[:])
  }
  if reader.afterRead != nil { reader.afterRead(name) }
  return content, err
}

func (reader *markdownCaptureReader) Stat(name string) (os.FileInfo, error) {
  if reader.stats == nil { reader.stats = map[string]int{} }
  reader.stats[name]++
  return os.Stat(name)
}
func (*markdownCaptureReader) Lstat(name string) (os.FileInfo, error) { return os.Lstat(name) }
func (*markdownCaptureReader) ReadDir(name string) ([]os.DirEntry, error) { return os.ReadDir(name) }
func (*markdownCaptureReader) Readlink(name string) (string, error) { return os.Readlink(name) }
func (*markdownCaptureReader) EvalSymlinks(name string) (string, error) { return filepath.EvalSymlinks(name) }
func (reader *markdownCaptureReader) Unavailable() { reader.unavailable = true }
func (reader *markdownCaptureReader) WalkDir(name string, visit fs.WalkDirFunc) error {
  reader.walks = append(reader.walks, name)
  var result error
  if err := reader.walkFailures[name]; err != nil {
    reader.Unavailable()
    result = visit(name, nil, err)
  } else {
    result = filepath.WalkDir(name, func(current string, entry fs.DirEntry, err error) error {
      if failure := reader.entryFailures[current]; failure != nil { err = failure; reader.Unavailable() }
      return visit(current, entry, err)
    })
  }
  if reader.afterWalk != nil { reader.afterWalk() }
  return result
}

func writeMarkdownCaptureFiles(t *testing.T, root string, files map[string]string) {
  t.Helper()
  for relative, content := range files {
    name := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil { t.Fatal(err) }
    if err := os.WriteFile(name, []byte(content), 0o644); err != nil { t.Fatal(err) }
  }
}

func runMarkdownCaptureGraph(t *testing.T, root, options string, reader *markdownCaptureReader) *capturedProjectReporter {
  t.Helper()
  reporter := &capturedProjectReporter{}
  context := rule.NewProjectContext(rule.ProjectIdentity{PhysicalProjectRoot: root}, nil, nil, rule.SeverityError, json.RawMessage(options), reporter)
  context.Inputs = reader
  graphRule{}.Check(context)
  return reporter
}

func markdownCaptureHints(root, options string, reporter *capturedProjectReporter) []rule.Hint {
  if reporter.failed { return nil }
  return graphRule{}.Hints(&rule.HintContext{Identity: rule.ProjectIdentity{PhysicalProjectRoot: root}, State: reporter.state, Severity: rule.SeverityError, Options: json.RawMessage(options)})
}
