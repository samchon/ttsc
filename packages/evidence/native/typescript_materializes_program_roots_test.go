package evidence

import (
  "encoding/json"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func rootedTypeScriptProgram(
  t *testing.T,
  files map[string]string,
  programFiles []string,
  config string,
) (string, graphConfig, []*shimast.SourceFile) {
  t.Helper()
  workspace := t.TempDir()
  root := filepath.Join(workspace, "packages", "backend")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  for relative, content := range files {
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  sources := make([]*shimast.SourceFile, 0, len(programFiles))
  for _, relative := range programFiles {
    content := files[relative]
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      content,
      shimcore.ScriptKindTS,
    ))
  }
  decoded, problems := decodeGraphConfig(json.RawMessage(config))
  if len(problems) != 0 {
    t.Fatalf("configuration did not decode: %s", strings.Join(problems, "\n"))
  }
  resolveGraphBases(root, &decoded)
  return root, decoded, sources
}
