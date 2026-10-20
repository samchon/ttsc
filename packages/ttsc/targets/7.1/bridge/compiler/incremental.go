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
  "time"
  _ "unsafe"

  innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
  "github.com/microsoft/TypeScript/tsc/internal/collections"
  innercompiler "github.com/microsoft/TypeScript/tsc/internal/compiler"
  innertsoptions "github.com/microsoft/TypeScript/tsc/internal/tsoptions"
  "github.com/microsoft/TypeScript/tsc/internal/tspath"

  // Imported for EmitFreshWithBuildInfo below, and for the linknamed symbols
  // further down: compiling the package into every shim consumer is what makes
  // those references resolve.
  "github.com/microsoft/TypeScript/tsc/internal/execute/incremental"
)

// EmitFreshWithBuildInfo emits through a new upstream incremental wrapper
// around the supplied checked Program, with no previous wrapper/snapshot.
// Its build-information format and candidate location come from upstream
// snapshot serialization and outputpaths.GetBuildInfoFileName.
//
// This is the emit half of `tsc.go::performIncrementalCompilation`, which the
// tsgo CLI takes whenever `CompilerOptions.IsIncremental()`. A host that builds
// its Program in-process (ttsc's driver, and therefore every plugin sidecar
// emitting through it) never reaches that CLI path, so without this the build
// information is silently dropped even though the options parsed cleanly.
//
// "Fresh" in EmitFreshWithBuildInfo means no previous snapshot is supplied.
// When upstream incremental-state tracking is enabled, initial construction
// tracks loaded files and makes their applicable output pending rather than
// reusing prior emit signatures or diagnostics. TargetSourceFile still selects
// single-file emission; noEmit/noEmitOnError, cancellation, blocked output and
// write failure retain their upstream behavior. A whole-program eligible emit
// attempts pending build info, but a record is not guaranteed on every call.
// The supplied Program and context must be valid for this emit round. A plugin's
// output is not a pure function of the source text a build info records — it
// also depends on the plugin binary, its config file, and its contributors —
// so reusing a previous snapshot to skip a file would serve stale transformed
// output. Using a record to skip plugin effects requires a reuse identity that
// covers every relevant input and effect, not source text alone.
//
// @evidence contracts/common.md#principled-implementation A nil previous wrapper prevents reuse of old snapshot emit signatures/diagnostics and initializes applicable pending output under upstream emit controls; source-only prior state cannot establish plugin-effect equivalence.
// @evidence contracts/common.md#clear-and-simple-design One upstream incremental-program construction owns full emit and build-info output, avoiding a separate record serializer or a partially reused emit path.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Fresh emission is grounded in absent plugin identity in the snapshot key, not a blanket retry masking stale output; no fake build-info or consumer-specific cache key is introduced.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the in-process build-info connection, fresh pending state, emit/cancellation/write limits and plugin-effect invalidation rather than unconditional output or incremental reuse.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This wrapper chooses snapshot reuse, while Program.Host and the upstream incremental emitter own native output-path and filesystem decisions.
// @evidence contracts/performance.md#efficient-algorithms The fresh wrapper reuses the checked Program but builds snapshot file hashes, references and semantic metadata; eligible output then incurs emission and additional build-info table traversal/JSON serialization. File, reference, source/output-byte and diagnostic populations drive this work. Delegating the actual engine avoids a separate record implementation, not those traversals; prior snapshot skipping is unsafe without plugin-equivalent inputs/effects.
// @evidence contracts/performance.md#reuse-equivalent-work The supplied checked Program is reused, while no previous incremental wrapper is admitted. Skipping effectful emission requires identity and invalidation covering all plugin/runtime/configuration/contributor dependencies and effects; quiet source text alone cannot authorize it.
// @evidence contracts/performance.md#bound-retention-and-release-resources The invocation acquires an incremental snapshot with file/reference/pending/diagnostic state plus temporary emission and build-info serialization storage. It retains the supplied Program while upstream work runs; returned results and WriteFile callback data may retain output or semantic references afterward. This adapter keeps no historical snapshot registry or independent running-task owner, and caller/host/upstream own result, callback and Program lifetimes on success, error or cancellation.
func EmitFreshWithBuildInfo(ctx context.Context, program *Program, options EmitOptions) *EmitResult {
  incrementalProgram := incremental.NewProgram(
    program,
    nil,
    incremental.CreateHost(program.Host()),
    time.Now,
    false,
  )
  return incrementalProgram.Emit(ctx, options)
}

//go:linkname incrementalGetReferencedFiles github.com/microsoft/TypeScript/tsc/internal/execute/incremental.getReferencedFiles
func incrementalGetReferencedFiles(program *innercompiler.Program, file *innerast.SourceFile) *collections.Set[tspath.PathKey]

//go:linkname incrementalFileAffectsGlobalScope github.com/microsoft/TypeScript/tsc/internal/execute/incremental.fileAffectsGlobalScope
func incrementalFileAffectsGlobalScope(file *innerast.SourceFile) bool

// GetReferencedFilePaths adapts the upstream incremental reference set:
// import/re-export and string module-augmentation symbols' declaration files,
// path directives, resolved type directives and ambient-module declarations.
// It is not a transitive symbol-reachability closure or proof that every path
// is a loaded source. Extensionless path-directive adaptation below can also
// differ from the raw upstream build-info entry.
//
// The returned keys are tspath.PathKey values (case-canonicalized on
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
// @evidence contracts/portability.md#os-neutral-implementation Path identity uses the Program's own path keys and compiler path helpers, while project-reference redirects recover the loaded filename rather than inferring native case behavior from the OS.
// @evidence contracts/performance.md#efficient-algorithms Adaptation uses expected linear map/set processing in upstream reference count plus path-directive count, with path-text hashing/canonicalization and a bounded supported-extension search per unresolved directive. Before that, upstream obtains a checker and visits import/augmentation symbols, their declarations and ambient modules; semantic lookup, declaration parent walks and host/project-reference queries are additional delegated work, not bounded by the returned path count alone.
// @evidence contracts/performance.md#reuse-equivalent-work Loaded Program resolutions, sources and checker state are reused, while the reference set and adaptation maps are rebuilt per invocation. Upstream checker queries may populate semantic caches; this adapter coordinates no cross-Program cache or separate resolver producer.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream acquires a file checker with a deferred release callback and may retain semantic state under its Program/checker owner. Reference, replacement and deduplication sets are invocation-local; returned slice/string ownership transfers to the caller and may share existing path backing storage. The bridge keeps no historical result registry.
func GetReferencedFilePaths(program *Program, file *innerast.SourceFile) []tspath.PathKey {
  set := incrementalGetReferencedFiles(program, file)
  if set == nil {
    return nil
  }
  resolvedPathReferences := make(map[tspath.PathKey]tspath.PathKey, len(file.ReferencedFiles))
  sourceDirectory := file.FileName().Directory()
  for _, reference := range file.ReferencedFiles {
    referencedFile := tspath.ToRootedFilePath(reference.FileName, sourceDirectory)
    if redirect := program.GetParseFileRedirect(referencedFile); redirect != "" {
      referencedFile = redirect
    }
    rawPath := program.PathKeyForFileName(referencedFile)
    if resolved := getSourceFileFromReference(program, file, reference); resolved != nil {
      resolvedPathReferences[rawPath] = resolved.PathKey()
    }
  }
  out := make([]tspath.PathKey, 0, set.Len())
  seen := collections.Set[tspath.PathKey]{}
  for path := range set.Keys() {
    if resolved := resolvedPathReferences[path]; resolved != "" {
      path = resolved
    }
    if seen.Has(path) {
      continue
    }
    seen.Add(path)
    out = append(out, path)
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
  referencedFile := tspath.ToRootedFilePath(reference.FileName, file.FileName().Directory())
  if referencedFile.HasExtension() {
    return nil
  }
  supportedExtensions := innertsoptions.GetSupportedExtensions(program.Options(), nil)
  supportedExtensions = innertsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(program.Options(), supportedExtensions)
  for _, extension := range supportedExtensions[0] {
    outputPath := program.PathKeyForFileName(referencedFile.AppendSuffix(extension))
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

// FileAffectsGlobalScope reports the upstream incremental engine's global
// impact classification, first ensuring the source file is bound. A global
// augmentation is true; otherwise external/CommonJS modules and JSON are false.
// A remaining script is true only when it has a statement other than a
// string-literal-named module declaration. Empty or ambient-external-only
// scripts are not automatically global-impact files.
// file must be a nonnil compiler source file.
//
// @evidence contracts/common.md#principled-implementation The wrapper delegates the pinned incremental engine's global-scope predicate, preserving the same distinction used for program-wide semantic invalidation.
// @evidence contracts/common.md#clear-and-simple-design One predicate exposes compiler-owned classification without an independent global-scope analysis.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path, project name or expected invalidation result is special-cased; the foreign predicate remains unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose states binding, augmentation/module/JSON/script distinctions, empty/ambient-only limits and the nonnil source-file premise without certifying every edit's runtime invalidation result.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Global-scope syntax classification has no native filesystem or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream binding and global-impact classification own their algorithms: an unbound file can incur AST binding, then augmentation/statement scans short-circuit according to the classification. This direct bridge chooses no independent traversal or impact analysis.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Upstream IsBound/BindOnce and its binder pool own binding reuse; this bridge coordinates no separate impact-result cache or cross-generation producer/invalidation policy.
// @evidence contracts/performance.md#bound-retention-and-release-resources Binding can acquire a pooled binder and populate source-owned symbols, flow and classification state; its defer returns and resets the binder while that bound AST state survives under the file owner. The bridge returns only a boolean and keeps no independent state registry or handle, but does not equate that with absence of delegated retention.
func FileAffectsGlobalScope(file *innerast.SourceFile) bool {
  return incrementalFileAffectsGlobalScope(file)
}
