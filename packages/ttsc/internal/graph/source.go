package graph

import (
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// IsWorkspaceSourceFile reports whether file owns declarations and outgoing
// facts in the project graph. Declaration files and reported filenames with an
// exact lowercase node_modules segment are external boundary inputs even when the checker loads a
// package's raw TypeScript entry for type checking.
//
// Classification follows the supplied compiler spelling. Compiler symlink
// settings can affect that spelling; this predicate neither resolves physical
// aliases nor proves where an existing file resides.
//
// @evidence contracts/common.md#principled-implementation The compiler's declaration-file flag and path-segment boundary distinguish authored declarations from loaded dependency inputs.
// @evidence contracts/common.md#clear-and-simple-design One predicate owns the build and resolution boundary without reopening source files.
// @evidence contracts/common.md#prohibited-implementation-shortcuts node_modules is a package-resolution boundary, not a consumer or fixture exception; no foreign compiler state is changed.
// @evidence contracts/common.md#meaningful-documentation Native prose states declaration-file and exact path-segment classification, reported spelling and physical alias limits under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath.ToSlash converts native separators for segment comparison while retaining literal POSIX backslashes; physical symlink resolution remains the compiler host's responsibility.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This predicate owns no retained cache or handle; temporary normalized/joined filename storage becomes unreachable when its boolean result returns.
// @evidence contracts/performance.md#efficient-algorithms The early nil/declaration-file guard is fixed work; normalization, prefix construction and segment search scan filename bytes and can allocate temporary path strings. No directory traversal occurs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This per-source predicate coordinates no shared generation computation or invalidation; callers own reuse of compiler filenames and classification results.
func IsWorkspaceSourceFile(file *shimast.SourceFile) bool {
  if file == nil || file.IsDeclarationFile {
    return false
  }
  normalized := filepath.ToSlash(file.FileName().AsString())
  return !strings.Contains("/"+strings.TrimPrefix(normalized, "/"), "/node_modules/")
}
