// Package printer re-exports the typescript-go internal/printer types that the
// ttsc driver and transform plugins need to emit source text and allocate
// collision-safe generated identifiers. The surface is intentionally narrow.
package printer

import (
  "github.com/microsoft/typescript-go/internal/ast"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

// PrintHandlers supplies the pinned printer's global-name collision hook.
// Node substitution hooks from the legacy TypeScript printer are not exposed
// by this TypeScript-Go version.
//
// @evidence contracts/common.md#principled-implementation The alias retains the upstream HasGlobalName callback and its exact signature, so generated names can consult the same collision boundary as the compiler.
// @evidence contracts/common.md#clear-and-simple-design The printer receives one native hook value instead of another substitution or notification framework.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported callback injection supplies collision facts without replacing foreign printer methods; unavailable legacy hooks are not simulated.
// @evidence contracts/common.md#meaningful-documentation Native prose names the available hook and documents the absence of legacy node-substitution capabilities.
type PrintHandlers = innerprinter.PrintHandlers

// Printer holds the stateful emitter produced by NewPrinter.
//
// @evidence contracts/common.md#principled-implementation Go alias identity preserves upstream printer state and methods, allowing direct emission of compiler AST nodes without a parallel representation.
// @evidence contracts/common.md#clear-and-simple-design The existing emitter remains the single printing owner; this alias adds no mutable wrapper state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Emission uses the actual compiler printer rather than source-spelling replacements or patched internals.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies stateful construction provenance; NewPrinter documents shared emit-context use.
type Printer = innerprinter.Printer

// PrinterOptions configures newline style, source-map generation, and other
// emission knobs.
//
// @evidence contracts/common.md#principled-implementation Aliasing the complete pinned options struct preserves the printer's supported fields and enum identities instead of losing settings in an incomplete copied schema.
// @evidence contracts/common.md#clear-and-simple-design One native options value configures all printer constructors, without independent defaults or translation in the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Settings remain caller data; the alias adds no consumer-specific emission overrides.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies newline and source-map configuration, distinct from the printer's retained state.
type PrinterOptions = innerprinter.PrinterOptions

// EmitContext owns per-emit node provenance, generated names and helper state.
// Create it fresh via NewEmitContext and share it across one transform/emit round.
//
// @evidence contracts/common.md#principled-implementation The alias retains the compiler's original-node links, naming metadata and node factory identity, allowing transformations and printing to interpret one shared provenance graph.
// @evidence contracts/common.md#clear-and-simple-design One upstream context couples related emit operations; separate rounds use separate contexts rather than another metadata synchronization layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Context state is supplied through the supported API rather than process-global caches or foreign AST metadata patches.
// @evidence contracts/common.md#meaningful-documentation Native prose states actual retained metadata and the one-round sharing/lifetime boundary.
type EmitContext = innerprinter.EmitContext

// AutoGenerateOptions configures how NodeFactory allocates generated names.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream naming flags, prefix and suffix fields exactly, matching the emit context's generated-name policy.
// @evidence contracts/common.md#clear-and-simple-design One options value groups the naming decision without a parallel identifier allocator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Naming policy uses compiler flags and caller spelling rather than fixed names chosen for known consumers.
// @evidence contracts/common.md#meaningful-documentation The comment identifies generated-name allocation rather than treating this as general printer formatting options.
type AutoGenerateOptions = innerprinter.AutoGenerateOptions

// GeneratedIdentifierFlags controls generated-name scope and collision checks.
//
// @evidence contracts/common.md#principled-implementation Go alias identity keeps the upstream name-kind and policy bits compatible with AutoGenerateOptions and the adjacent forwarded constants.
// @evidence contracts/common.md#clear-and-simple-design One native flag representation expresses generated-name policy without a shim-owned enum translation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flags use compiler definitions rather than guessed numeric bits or consumer-specific naming exemptions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies scope and collision policy, and adjacent constants expose the supported flag family.
type GeneratedIdentifierFlags = innerprinter.GeneratedIdentifierFlags

const (
  GeneratedIdentifierFlagsNone                   = innerprinter.GeneratedIdentifierFlagsNone
  GeneratedIdentifierFlagsAuto                   = innerprinter.GeneratedIdentifierFlagsAuto
  GeneratedIdentifierFlagsLoop                   = innerprinter.GeneratedIdentifierFlagsLoop
  GeneratedIdentifierFlagsUnique                 = innerprinter.GeneratedIdentifierFlagsUnique
  GeneratedIdentifierFlagsNode                   = innerprinter.GeneratedIdentifierFlagsNode
  GeneratedIdentifierFlagsKindMask               = innerprinter.GeneratedIdentifierFlagsKindMask
  GeneratedIdentifierFlagsReservedInNestedScopes = innerprinter.GeneratedIdentifierFlagsReservedInNestedScopes
  GeneratedIdentifierFlagsOptimistic             = innerprinter.GeneratedIdentifierFlagsOptimistic
  GeneratedIdentifierFlagsFileLevel              = innerprinter.GeneratedIdentifierFlagsFileLevel
  GeneratedIdentifierFlagsAllowNameSubstitution  = innerprinter.GeneratedIdentifierFlagsAllowNameSubstitution
)

// NewPrinter creates an emitter with the supplied options, global-name hook,
// and emit context. Callers must pass the same EmitContext to all operations
// in a single emit round.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream printer construction over the supplied options, hook and shared context, so transformed-node provenance remains available during emission.
// @evidence contracts/common.md#clear-and-simple-design One constructor keeps printer state with the emitter while the caller explicitly supplies the context shared by the round.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported constructor accepts dependencies directly without replacing printer internals or injecting a consumer-specific emitter.
// @evidence contracts/common.md#meaningful-documentation Native prose states the actual hook and one-round context identity requirement.
func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
  return innerprinter.NewPrinter(options, handlers, emitContext)
}

// NewEmitContext allocates a fresh EmitContext for a new emit round.
//
// @evidence contracts/common.md#principled-implementation The upstream constructor initializes the context's own node factory; each call obtains a separate metadata identity for a separate emit round.
// @evidence contracts/common.md#clear-and-simple-design One factory creates the context and its coupled factory together rather than exposing partially initialized emit state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Calls acquire real fresh upstream state rather than sharing a process-global context across unrelated emit rounds.
// @evidence contracts/common.md#meaningful-documentation The comment identifies fresh allocation and its per-round purpose; the context type explains sharing within that round.
func NewEmitContext() *EmitContext {
  return innerprinter.NewEmitContext()
}

// EmitSourceFile renders the full source file through the printer and returns
// the emitted text.
//
// @evidence contracts/common.md#principled-implementation Delegating to the supplied upstream printer preserves AST-aware source emission; callers provide a real source file and a printer constructed for their emit context.
// @evidence contracts/common.md#clear-and-simple-design A single rendering adapter returns text while printer configuration and context construction retain their separate owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source text is produced by compiler AST printing rather than guessed textual substitution or fixture-specific output.
// @evidence contracts/common.md#meaningful-documentation Native prose states full-file rendering and the returned text, distinct from the source-map companion operation.
func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
  return p.EmitSourceFile(sourceFile)
}
