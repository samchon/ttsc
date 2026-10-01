package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

func parseTS(t *testing.T, source string) *shimast.SourceFile {
  t.Helper()
  opts := shimast.SourceFileParseOptions{FileName: filepath.ToSlash("/virtual/test.ts")}
  file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
  if file == nil {
    t.Fatalf("nil")
  }
  return file
}
