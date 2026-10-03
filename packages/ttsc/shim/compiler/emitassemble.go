// gen_shims:hand-maintained
//
// Emit-pipeline assembly parts: pick the files tsgo would emit and resolve
// their output paths, so ttsc's driver can drive emit per file with a plugin
// transformer inserted ahead of the builtin chain.
package compiler

import (
  _ "unsafe"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  innercompiler "github.com/microsoft/typescript-go/internal/compiler"
  innercore "github.com/microsoft/typescript-go/internal/core"
  inneroutputpaths "github.com/microsoft/typescript-go/internal/outputpaths"
)

// GetSourceFilesToEmit returns the source files tsgo would emit for the program
// (excludes .d.ts and external-library files), linked from the internal package.
//
// @evidence contracts/common.md#principled-implementation Linking the pinned compiler's own selection helper preserves its target-file, declaration and compiler-option eligibility decisions rather than recreating emit selection.
// @evidence contracts/common.md#clear-and-simple-design The direct declaration exposes selection independently of output writing, allowing the driver to insert transformers while retaining compiler ownership of eligible files.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The symbol bridge exposes upstream behavior without replacing it; forceDtsEmit is an actual compiler control, not a fixture exception.
// @evidence contracts/common.md#meaningful-documentation Native prose describes emitted-file selection and internal linkage, with the acknowledgment separated from the Go linkage directive.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This exposes upstream emit eligibility and does not choose native path identity or perform filesystem access.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSourceFilesToEmit declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetSourceFilesToEmit declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetSourceFilesToEmit declares a signature only; the implementation owns any shared work.
//
//go:linkname GetSourceFilesToEmit github.com/microsoft/typescript-go/internal/compiler.getSourceFilesToEmit
func GetSourceFilesToEmit(host innercompiler.SourceFileMayBeEmittedHost, targetSourceFile *innerast.SourceFile, forceDtsEmit bool) []*innerast.SourceFile

// OutputPaths holds the resolved output file paths for one source file.
// Empty fields represent outputs disabled by the compiler options.
//
// @evidence contracts/common.md#principled-implementation The exact upstream output-path alias preserves separate script, declaration and map destinations, including absent outputs, without losing compiler-resolved path distinctions.
// @evidence contracts/common.md#clear-and-simple-design One compiler-owned result groups related outputs for a source file, avoiding independently recomputed paths at each sink.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias does not insert consumer-specific filenames or alter output policy.
// @evidence contracts/common.md#meaningful-documentation Native prose states per-file output ownership and the meaning of empty destinations.
// @evidence contracts/portability.md#os-neutral-implementation Output fields preserve the compiler's host-resolved native destinations, including absent outputs, rather than imposing URL spelling or an OS-derived case policy.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type OutputPaths = inneroutputpaths.OutputPaths

// GetOutputPathsFor resolves script, declaration and map destinations using
// upstream extension and output-directory policy. The script extension can
// also be .jsx, .mjs, .cjs or .json; disabled or suppressed outputs are empty.
// The host supplies the common source directory, current directory and case
// policy. This is path selection, not proof that emit writes every destination.
// sourceFile, options and host must satisfy the upstream resolver's premises.
//
// @evidence contracts/common.md#principled-implementation The wrapper delegates the same source file, options, host and declaration-emission control to the compiler's output-path algorithm, preserving root and output directory semantics.
// @evidence contracts/common.md#clear-and-simple-design Output placement remains in upstream's owning helper; this adapter only exposes that boundary to the driver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path is fabricated from a consumer or fixture name, and the upstream output resolver is neither copied nor patched.
// @evidence contracts/common.md#meaningful-documentation Native prose names the output classes, relevant directory options and host context, with a separate acknowledgment section.
// @evidence contracts/portability.md#os-neutral-implementation Upstream's output resolver receives the actual host directory and path-identity policy; the shim does not guess separators, drive roots or case sensitivity from an OS name.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream allocates a returned OutputPaths object and constructs or borrows destination strings; their backing storage survives with the caller's result. Host-owned directory and case-policy state remains with the host. This bridge acquires no independent file handle or persistent result registry.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns extension selection, path normalization, comparison and directory remapping, including work proportional to path text and any host directory lookup. This direct adapter chooses no separate output-path algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Output-path computation and any reusable common-directory or host metadata belong to the upstream resolver and host. This bridge coordinates no independent cache or cross-call producer.
func GetOutputPathsFor(sourceFile *innerast.SourceFile, options *innercore.CompilerOptions, host inneroutputpaths.OutputPathsHost, forceDtsEmit bool) *inneroutputpaths.OutputPaths {
  return inneroutputpaths.GetOutputPathsFor(sourceFile, options, host, forceDtsEmit)
}
