// gen_shims:hand-maintained
//
// Reference-graph parts of tsgo's own incremental engine (`tsc --incremental`
// semantics), linked from internal/execute/incremental so ttsc's transform
// envelopes can carry the same language-semantic input bound the compiler
// itself uses for invalidation: per-file direct resolved references and the
// files that contribute to the global scope.
package compiler

import (
  _ "unsafe"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/collections"
  innercompiler "github.com/microsoft/typescript-go/internal/compiler"
  "github.com/microsoft/typescript-go/internal/tspath"

  // The linknamed symbols below live in the incremental package; the blank
  // import compiles it into every shim consumer so the references resolve.
  _ "github.com/microsoft/typescript-go/internal/execute/incremental"
)

//go:linkname incrementalGetReferencedFiles github.com/microsoft/typescript-go/internal/execute/incremental.getReferencedFiles
func incrementalGetReferencedFiles(program *innercompiler.Program, file *innerast.SourceFile) *collections.Set[tspath.Path]

//go:linkname incrementalFileAffectsGlobalScope github.com/microsoft/typescript-go/internal/execute/incremental.fileAffectsGlobalScope
func incrementalFileAffectsGlobalScope(file *innerast.SourceFile) bool

// GetReferencedFilePaths returns the canonical paths of every file that `file`
// directly references in `program`: resolved imports and re-exports (type-only
// included), `/// <reference>` targets, resolved type reference directives,
// module augmentations, and ambient-module declaration files. This is exactly
// the per-file `referencedMap` entry tsgo's incremental engine stores in
// `tsbuildinfo`, so the result is the sound language-semantic upper bound on
// which program files a symbol in `file` can resolve through.
//
// The returned strings are tspath.Path values (case-canonicalized on
// case-insensitive filesystems); map them back to real file names through
// Program.GetSourceFileByPath when the original spelling matters.
func GetReferencedFilePaths(program *Program, file *innerast.SourceFile) []string {
  set := incrementalGetReferencedFiles(program, file)
  if set == nil {
    return nil
  }
  out := make([]string, 0, set.Len())
  for path := range set.Keys() {
    out = append(out, string(path))
  }
  return out
}

// FileAffectsGlobalScope reports whether editing `file` can change the global
// scope: global-scope module augmentations, ambient declaration files, and
// script (non-module) files. Mirrors the predicate tsgo's incremental engine
// uses to decide that a change must invalidate every file in the program.
func FileAffectsGlobalScope(file *innerast.SourceFile) bool {
  return incrementalFileAffectsGlobalScope(file)
}
