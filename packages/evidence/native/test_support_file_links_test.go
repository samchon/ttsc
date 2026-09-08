package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// A disk fixture keeps Program membership explicit. Automatically including
// every .ts fixture would let the Program hide failures in the disk resolver.
type fileLinkFixture struct {
  t       *testing.T
  root    string
  options json.RawMessage
  sources []*shimast.SourceFile
}

func newFileLinkFixture(t *testing.T, files map[string]string, options string) *fileLinkFixture {
  t.Helper()
  fixture := &fileLinkFixture{t: t, root: t.TempDir(), options: json.RawMessage(options)}
  for relative, content := range files {
    fixture.write(relative, content)
  }
  return fixture
}

func (fixture *fileLinkFixture) write(relative string, content string) {
  fixture.t.Helper()
  file := filepath.Join(fixture.root, relative)
  if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
    fixture.t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(content), 0644); err != nil {
    fixture.t.Fatal(err)
  }
}

func (fixture *fileLinkFixture) source(relative string, content string) *shimast.SourceFile {
  kind := shimcore.ScriptKindTS
  if strings.HasSuffix(relative, ".tsx") {
    kind = shimcore.ScriptKindTSX
  }
  return shimparser.ParseSourceFile(shimast.SourceFileParseOptions{FileName: filepath.ToSlash(filepath.Join(fixture.root, relative))}, content, kind)
}

func (fixture *fileLinkFixture) check() []string {
  fixture.t.Helper()
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(rule.ProjectIdentity{PhysicalProjectRoot: fixture.root}, fixture.sources, nil, rule.SeverityError, fixture.options, reporter))
  return reporter.messages
}
