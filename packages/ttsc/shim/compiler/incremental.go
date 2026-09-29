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
//
// @evidence contracts/common.md#principled-implementation A nil previous snapshot makes the upstream incremental program treat every file as changed while still producing the compiler's build-information record; this is necessary because source-only snapshot identity cannot represent plugin inputs.
// @evidence contracts/common.md#clear-and-simple-design One upstream incremental-program construction owns full emit and build-info output, avoiding a separate record serializer or a partially reused emit path.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Fresh emission is grounded in absent plugin identity in the snapshot key, not a blanket retry masking stale output; no fake build-info or consumer-specific cache key is introduced.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the missing CLI path, fresh snapshot meaning and plugin-input invalidation limitation rather than promising incremental reuse.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This wrapper chooses snapshot reuse, while Program.Host and the upstream incremental emitter own native output-path and filesystem decisions.
// @evidence contracts/performance.md#efficient-algorithms The upstream engine traverses the files and emitted text of the whole program because no prior snapshot can prove plugin-equivalent output; using its emitter avoids a second traversal just to serialize build information.
// @evidence contracts/performance.md#reuse-equivalent-work The existing checked Program is reused, but skipping effectful file emission from source-only prior build information is invalid until plugin binary, configuration and contributor inputs enter the snapshot identity.
// @evidence contracts/performance.md#bound-retention-and-release-resources The incremental wrapper is invocation-local and retains the supplied Program during synchronous emission; no historical snapshot cache or new running task is kept by this adapter, while program and output lifetime remain with the caller and host.
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
// Program and file must be nonnil and belong to the same loaded program.
// Returned order follows the compiler's reference set; it is not sorted.
//
// @evidence contracts/common.md#principled-implementation Upstream's semantic reference set is combined with the same program's resolved path directives, replacing extensionless raw paths with loaded source identities and deduplicating canonical paths; project-reference redirects use the program's actual declaration-to-source mapping.
// @evidence contracts/common.md#clear-and-simple-design The exported function owns reference-set adaptation while a private helper resolves resident and virtual declaration sources through one program context.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The extra project-reference lookup addresses supported unbuilt declaration outputs using compiler redirects and supported extensions, rather than guessing filenames or special-casing projects.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs identify reference categories, canonical spelling, extension replacement, same-program premises and unsorted output with descriptive text separate from tags.
// @evidence contracts/portability.md#os-neutral-implementation Path identity uses Program.UseCaseSensitiveFileNames and compiler path helpers, while project-reference redirects recover the loaded filename rather than inferring native case behavior from the OS.
// @evidence contracts/performance.md#efficient-algorithms For R semantic references and P path directives, map/set lookup gives expected linear R plus P processing with a supported-extension loop for unresolved directives; temporary replacement and deduplication sets avoid pairwise scans.
// @evidence contracts/performance.md#reuse-equivalent-work The resident Program's resolution set and loaded files are reused; this adapter does not rerun module resolution or keep results across changed Program identities.
// @evidence contracts/performance.md#bound-retention-and-release-resources Replacement and deduplication maps are invocation-local, growing with path directives and reference count; ownership of the returned R-sized string slice transfers to the caller, with no historical retained cache.
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
// file must be a nonnil compiler source file.
//
// @evidence contracts/common.md#principled-implementation The wrapper delegates the pinned incremental engine's global-scope predicate, preserving the same distinction used for program-wide semantic invalidation.
// @evidence contracts/common.md#clear-and-simple-design One predicate exposes compiler-owned classification without an independent global-scope analysis.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path, project name or expected invalidation result is special-cased; the foreign predicate remains unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose lists relevant global-scope cases, explains invalidation significance and states the nonnil source-file premise.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Global-scope syntax classification has no native filesystem or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms This direct predicate exposes upstream classification without choosing an independent algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate does not coordinate computation across requests or consumers.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate owns no retained cache, handle or running task.
func FileAffectsGlobalScope(file *innerast.SourceFile) bool {
  return incrementalFileAffectsGlobalScope(file)
}
