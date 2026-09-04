// gen_shims:hand-maintained
//
// Parts of tsgo's own incremental engine (`tsc --incremental` semantics),
// exposed from internal/execute/incremental for the two things a ttsc host
// needs from it:
//
//   - the reference graph, so transform envelopes can carry the same
//     language-semantic input bound the compiler itself uses for invalidation:
//     per-file direct resolved references and the files that contribute to the
//     global scope;
//   - the build-information emit, so a host that constructs its Program
//     in-process still writes the `.tsbuildinfo` an `incremental` or
//     `composite` project asked for.
package compiler

import (
  "context"
  _ "unsafe"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/collections"
  innercompiler "github.com/microsoft/typescript-go/internal/compiler"
  innertsoptions "github.com/microsoft/typescript-go/internal/tsoptions"
  "github.com/microsoft/typescript-go/internal/tspath"

  // Imported for EmitFreshWithBuildInfo below, and for the linknamed symbols
  // further down: compiling the package into every shim consumer is what makes
  // those references resolve.
  "github.com/microsoft/typescript-go/internal/execute/incremental"
)

// EmitFreshWithBuildInfo runs a full emit through tsgo's own incremental
// program, so an `incremental` or `composite` project gets the `.tsbuildinfo`
// tsgo would have written, in the exact format and location
// `outputpaths.GetBuildInfoFileName` resolves from the compiler options.
//
// This is the emit half of `tsc.go::performIncrementalCompilation`, which the
// tsgo CLI takes whenever `CompilerOptions.IsIncremental()`. A host that builds
// its Program in-process (ttsc's driver, and therefore every plugin sidecar
// emitting through it) never reaches that CLI path, so without this the build
// information is silently dropped even though the options parsed cleanly.
//
// "Fresh" is the load-bearing word: no previous snapshot is supplied, so
// `programToSnapshot` marks every file changed and this emits the whole program
// exactly as `Program.Emit` does, then writes the build info. A ttsc plugin's
// output is not a pure function of the source text a build info records — it
// also depends on the plugin binary, its config file, and its contributors —
// so reusing a previous snapshot to skip a file would serve stale transformed
// output. Producing the record is sound; consuming it needs plugin identity in
// the invalidation key first.
func EmitFreshWithBuildInfo(ctx context.Context, program *Program, options EmitOptions) *EmitResult {
  incrementalProgram := incremental.NewProgram(
    program,
    nil,
    incremental.CreateHost(program.Host()),
    false,
  )
  return incrementalProgram.Emit(ctx, options)
}

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
// Extensionless path references are replaced with the source file Program
// actually loaded because the upstream incremental helper retains their raw
// directive path instead of the selected extension-bearing path.
func GetReferencedFilePaths(program *Program, file *innerast.SourceFile) []string {
  set := incrementalGetReferencedFiles(program, file)
  if set == nil {
    return nil
  }
  resolvedPathReferences := make(map[tspath.Path]tspath.Path, len(file.ReferencedFiles))
  sourceDirectory := tspath.GetDirectoryPath(file.FileName())
  for _, reference := range file.ReferencedFiles {
    referencedFile := reference.FileName
    if redirect := program.GetParseFileRedirect(referencedFile); redirect != "" {
      referencedFile = redirect
    }
    rawPath := tspath.ToPath(referencedFile, sourceDirectory, program.UseCaseSensitiveFileNames())
    if resolved := getSourceFileFromReference(program, file, reference); resolved != nil {
      resolvedPathReferences[rawPath] = resolved.Path()
    }
  }
  out := make([]string, 0, set.Len())
  seen := collections.Set[tspath.Path]{}
  for path := range set.Keys() {
    if resolved := resolvedPathReferences[path]; resolved != "" {
      path = resolved
    }
    if seen.Has(path) {
      continue
    }
    seen.Add(path)
    out = append(out, string(path))
  }
  return out
}

// getSourceFileFromReference extends TypeScript-Go's resident-file lookup with
// the virtual declaration outputs its project-reference filesystem accepts.
// The upstream helper cannot see an unbuilt output in Program.filesByPath, but
// the project-reference mapper retains the output-to-source redirect that made
// the reference valid while the Program was loaded.
func getSourceFileFromReference(program *Program, file *innerast.SourceFile, reference *innerast.FileReference) *innerast.SourceFile {
  if resolved := program.GetSourceFileFromReference(file, reference); resolved != nil {
    return resolved
  }
  referencedFile := tspath.ResolvePath(tspath.GetDirectoryPath(file.FileName()), reference.FileName)
  if tspath.HasExtension(referencedFile) {
    return nil
  }
  supportedExtensions := innertsoptions.GetSupportedExtensions(program.Options(), nil)
  supportedExtensions = innertsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(program.Options(), supportedExtensions)
  for _, extension := range supportedExtensions[0] {
    outputPath := tspath.ToPath(referencedFile+extension, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames())
    redirect := program.GetProjectReferenceFromOutputDts(outputPath)
    if redirect == nil {
      continue
    }
    if source := program.GetSourceFile(redirect.Source); source != nil {
      return source
    }
  }
  return nil
}

// FileAffectsGlobalScope reports whether editing `file` can change the global
// scope: global-scope module augmentations, ambient declaration files, and
// script (non-module) files. Mirrors the predicate tsgo's incremental engine
// uses to decide that a change must invalidate every file in the program.
func FileAffectsGlobalScope(file *innerast.SourceFile) bool {
  return incrementalFileAffectsGlobalScope(file)
}
