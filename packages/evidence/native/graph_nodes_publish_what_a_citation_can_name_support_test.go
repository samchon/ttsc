package evidence

import (
  "encoding/json"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/samchon/ttsc/packages/lint/rule"
  "os"
  "path/filepath"
  "sort"
  "testing"
)

// runGraphNodes materializes a graph and returns what it published, mirroring
// runGraphHints exactly — the two are projections of the same corpus and a
// difference in how they are driven would be a difference in what they prove.
func runGraphNodes(
  t *testing.T,
  files map[string]string,
  config string,
) ([]rule.GraphNode, []string) {
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
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      content,
      shimcore.ScriptKindTS,
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
  return graphRule{}.GraphNodes(&rule.GraphContext{
    Identity: rule.ProjectIdentity{PhysicalProjectRoot: root},
    State:    reporter.state,
    Severity: rule.SeverityError,
    Options:  json.RawMessage(config),
  }), reporter.messages
}

func sortedAddresses(nodes []rule.GraphNode) []string {
  addresses := make([]string, 0, len(nodes))
  for _, node := range nodes {
    addresses = append(addresses, node.Address)
  }
  sort.Strings(addresses)
  return addresses
}
