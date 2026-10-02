package graph

import (
  "path/filepath"
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
// @evidence contracts/portability.md#os-neutral-implementation filepath.ToSlash converts native separators for segment comparison while retaining literal POSIX backslashes; physical symlink resolution remains the compiler host's responsibility.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsWorkspaceSourceFile acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsWorkspaceSourceFile performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsWorkspaceSourceFile computes one result per call, so there is no repeated work to share.
func IsWorkspaceSourceFile(file *shimast.SourceFile) bool {
  if file == nil || file.IsDeclarationFile {
    return false
  }
  normalized := filepath.ToSlash(file.FileName())
  return !strings.Contains("/"+strings.TrimPrefix(normalized, "/"), "/node_modules/")
}
