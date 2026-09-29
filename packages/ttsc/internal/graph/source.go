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
//
// @evidence contracts/common.md#principled-implementation The compiler's declaration-file flag and path-segment boundary distinguish authored declarations from loaded dependency inputs.
// @evidence contracts/common.md#clear-and-simple-design One predicate owns the build and resolution boundary without reopening source files.
// @evidence contracts/common.md#prohibited-implementation-shortcuts node_modules is a package-resolution boundary, not a consumer or fixture exception; no foreign compiler state is changed.
// @evidence contracts/common.md#meaningful-documentation The native comment states declaration ownership and the compiler's default symlink handling, with prose separated from these tags under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Slash normalization compares compiler path segments rather than native case identities; physical symlink resolution remains the compiler host's responsibility.
func IsWorkspaceSourceFile(file *shimast.SourceFile) bool {
  if file == nil || file.IsDeclarationFile {
    return false
  }
  normalized := strings.ReplaceAll(file.FileName(), "\\", "/")
  return !strings.Contains("/"+strings.TrimPrefix(normalized, "/"), "/node_modules/")
}
