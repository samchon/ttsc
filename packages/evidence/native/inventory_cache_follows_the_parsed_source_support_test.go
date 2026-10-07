package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "testing"
)

func parseTestSource(t *testing.T, name string, content string) *shimast.SourceFile {
  t.Helper()
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: name},
    content,
    shimcore.ScriptKindTS,
  )
  if file == nil {
    t.Fatalf("the parser returned no source file for %s", name)
  }
  return file
}
