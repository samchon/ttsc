package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// IsWorkspaceSourceFile reports whether file owns declarations and outgoing
// facts in the project graph. Declaration files and sources physically resident
// under node_modules are external boundary inputs even when the checker loads a
// package's raw TypeScript entry for type checking.
//
// Symlinked workspace packages remain authored source: the checker resolves the
// default preserveSymlinks=false path to their real workspace location before
// this predicate sees it.
func IsWorkspaceSourceFile(file *shimast.SourceFile) bool {
  if file == nil || file.IsDeclarationFile {
    return false
  }
  normalized := strings.ReplaceAll(file.FileName(), "\\", "/")
  return !strings.Contains("/"+strings.TrimPrefix(normalized, "/"), "/node_modules/")
}
