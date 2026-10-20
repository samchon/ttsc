package evidence

import (
  "encoding/json"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/samchon/ttsc/packages/lint/rule"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

// runRootedGraph drives the graph rule inside a workspace whose project sits one
// directory down, so a population can declare a root that ascends out of it.
//
// The layout is the whole point. `runIndexRule` makes the temp directory the
// project root, which leaves nowhere above it a case may write to without
// littering a directory other tests share — and "above the project" is exactly
// the location this property exists to reach.
//
// Keys are workspace-relative. Files under `project/` become the ttsc program;
// everything else is a sibling of it.
func runRootedGraph(
  t *testing.T,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  return runRootedGraphIn(t, t.TempDir(), files, config)
}

// runRootedGraphIn drives the same workspace from a caller-owned directory, for
// the cases whose configuration has to name that directory.
//
// An absolute declared root cannot be written into a literal config string
// against a workspace the helper allocates for itself, and it is the one form
// where the declared spelling and the derived one differ — so the property those
// cases exist to prove is unreachable without the caller owning the workspace.
func runRootedGraphIn(
  t *testing.T,
  workspace string,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    content := files[relative]
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
    if !strings.HasPrefix(relative, "project/") ||
      !isTypeScriptTestPath(relative) {
      continue
    }
    kind := shimcore.ScriptKindTS
    if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
      kind = shimcore.ScriptKindTSX
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: shimtspath.RootedFilePathFromAbsolute(absolute)},
      content,
      kind,
    ))
  }
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(config),
    reporter,
  ))
  sort.Strings(reporter.messages)
  return reporter.messages
}
