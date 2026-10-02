// gen_shims:hand-maintained
//
// Re-exports the emit host/resolver interfaces so ttsc's driver can implement
// its own EmitHost (delegating to driver.Program) and hand it to
// compiler.GetScriptTransformers when assembling the emit pipeline.
package printer

import innerprinter "github.com/microsoft/typescript-go/internal/printer"

// EmitHost is the per-emit host interface tsgo's transformers query (Options,
// SourceFiles, GetEmitResolver, GetEmitModuleFormatOfFile, WriteFile, ...).
//
// @evidence contracts/common.md#principled-implementation The exact upstream interface alias preserves the option, resolver and output callbacks its transformer chain requires; driver hosts satisfy that same contract without conversion.
// @evidence contracts/common.md#clear-and-simple-design One interface alias exposes the owning compiler boundary instead of a second host abstraction with independently maintained methods.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Implementing this interface is supported dependency injection; the alias neither patches a host instance nor changes upstream dispatch.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the per-emit role and representative queries, while the package introduction explains the driver-to-transformer use.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EmitHost = innerprinter.EmitHost

// EmitResolver resolves emit-time facts about nodes (referenced imports,
// declaration flags, ...) under the checker mutex.
// The caller owns synchronization of the checker used by its resolver.
//
// @evidence contracts/common.md#principled-implementation An exact resolver interface alias retains the compiler's emit-time semantic queries and lets the host supply facts from the same checked program.
// @evidence contracts/common.md#clear-and-simple-design The alias exposes the existing semantic boundary without duplicating checker state or inventing another resolver protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host supplies a resolver through upstream's interface; no foreign method or checker global is replaced.
// @evidence contracts/common.md#meaningful-documentation Native prose names emit-time facts and caller-owned synchronization rather than implying the alias itself acquires a mutex.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EmitResolver = innerprinter.EmitResolver

// EmitTextWriter is the sink the printer emits into; String() yields the text.
//
// @evidence contracts/common.md#principled-implementation The upstream writer interface alias preserves printing operations and text extraction as one compatible sink contract.
// @evidence contracts/common.md#clear-and-simple-design The printer and host share the existing sink interface, avoiding a separate buffering adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration introduces no replacement methods, fixture dispatch or compensating behavior.
// @evidence contracts/common.md#meaningful-documentation Native prose states the sink's output role and how callers obtain its accumulated text.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EmitTextWriter = innerprinter.EmitTextWriter

// NewTextWriter creates a fresh writer for one emit (newLine e.g. "\n").
// indentSize controls spaces per indentation level; nonpositive values select
// the pinned writer's default of four spaces.
//
// @evidence contracts/common.md#principled-implementation Delegating newline and indentation width preserves upstream position accounting and its four-space fallback for nonpositive widths.
// @evidence contracts/common.md#clear-and-simple-design The constructor returns one fresh upstream sink without shared buffers or additional output policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Formatting parameters are explicit inputs; no consumer-specific formatting or foreign method replacement is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose states writer lifetime, newline example, indentation units and nonpositive-width default with tags separated from descriptive text.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewTextWriter acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewTextWriter performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewTextWriter computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewTextWriter computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewTextWriter(newLine string, indentSize int) EmitTextWriter {
  return innerprinter.NewTextWriter(newLine, indentSize)
}
