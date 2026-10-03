// Package printer re-exports the typescript-go internal/printer types that the
// ttsc driver and transform plugins need to emit source text and allocate
// collision-safe generated identifiers. The surface is intentionally narrow.
package printer

import (
  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/core"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

// PrintHandlers supplies the pinned printer's global-name collision hook and
// before/after notifications for nodes, node lists and tokens. The legacy
// node-substitution and custom emit-callback hooks are not exposed by this
// TypeScript-Go version.
//
// @evidence contracts/common.md#principled-implementation The alias preserves HasGlobalName and the six node/list/token notification callbacks with their upstream signatures, allowing collision queries and traversal observations through the printer's actual supported boundaries.
// @evidence contracts/common.md#clear-and-simple-design One upstream handler value groups collision queries and traversal notifications without a separate dispatch framework or a shim-owned substitution protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported callback injection supplies collision facts and traversal observations without replacing foreign printer methods; unavailable legacy substitution and custom emit callbacks are not simulated.
// @evidence contracts/common.md#meaningful-documentation Native prose names the available callback families and distinguishes their notifications from unavailable legacy substitution and custom emission hooks.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PrintHandlers = innerprinter.PrintHandlers

// Printer holds the stateful emitter produced by NewPrinter.
//
// @evidence contracts/common.md#principled-implementation Go alias identity preserves upstream printer state and methods, allowing direct emission of compiler AST nodes without a parallel representation.
// @evidence contracts/common.md#clear-and-simple-design The existing emitter remains the single printing owner; this alias adds no mutable wrapper state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Emission uses the actual compiler printer rather than source-spelling replacements or patched internals.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies stateful construction provenance; NewPrinter documents shared emit-context use.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Printer = innerprinter.Printer

// PrinterOptions configures newline style, source-map generation, and other
// emission knobs.
//
// @evidence contracts/common.md#principled-implementation Aliasing the complete pinned options struct preserves the printer's supported fields and enum identities instead of losing settings in an incomplete copied schema.
// @evidence contracts/common.md#clear-and-simple-design One native options value configures all printer constructors, without independent defaults or translation in the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Settings remain caller data; the alias adds no consumer-specific emission overrides.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies newline and source-map configuration, distinct from the printer's retained state.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PrinterOptions = innerprinter.PrinterOptions

// EmitContext owns per-emit node provenance, generated names and helper state.
// Create it fresh via NewEmitContext and share it across one transform/emit round.
//
// @evidence contracts/common.md#principled-implementation The alias retains the compiler's original-node links, naming metadata and node factory identity, allowing transformations and printing to interpret one shared provenance graph.
// @evidence contracts/common.md#clear-and-simple-design One upstream context couples related emit operations; separate rounds use separate contexts rather than another metadata synchronization layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Context state is supplied through the supported API rather than process-global caches or foreign AST metadata patches.
// @evidence contracts/common.md#meaningful-documentation Native prose states actual retained metadata and the one-round sharing/lifetime boundary.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EmitContext = innerprinter.EmitContext

// AutoGenerateOptions configures how NodeFactory allocates generated names.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream naming flags, prefix and suffix fields exactly, matching the emit context's generated-name policy.
// @evidence contracts/common.md#clear-and-simple-design One options value groups the naming decision without a parallel identifier allocator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Naming policy uses compiler flags and caller spelling rather than fixed names chosen for known consumers.
// @evidence contracts/common.md#meaningful-documentation The comment identifies generated-name allocation rather than treating this as general printer formatting options.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type AutoGenerateOptions = innerprinter.AutoGenerateOptions

// GeneratedIdentifierFlags controls generated-name scope and collision checks.
//
// @evidence contracts/common.md#principled-implementation Go alias identity keeps the upstream name-kind and policy bits compatible with AutoGenerateOptions and the adjacent forwarded constants.
// @evidence contracts/common.md#clear-and-simple-design One native flag representation expresses generated-name policy without a shim-owned enum translation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flags use compiler definitions rather than guessed numeric bits or consumer-specific naming exemptions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies scope and collision policy, and adjacent constants expose the supported flag family.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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

// NewPrinter creates an emitter with the supplied options, handlers and emit
// context. A nil context creates a fresh upstream context; operations that
// depend on one round's shared node provenance must pass that same context.
// The returned printer keeps its context and handler references; callers own
// their lifetimes and must respect the upstream mutable-state contract.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream printer construction over the supplied options, hook and shared context, so transformed-node provenance remains available during emission.
// @evidence contracts/common.md#clear-and-simple-design One constructor keeps printer state with the emitter while the caller explicitly supplies the context shared by the round.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported constructor accepts dependencies directly without replacing printer internals or injecting a consumer-specific emitter.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies supplied handlers, nil-context allocation, provenance sharing and caller-owned mutable printer state.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned printer retains handlers and its supplied or newly created context, with name-generator closures referencing that printer; later writer and name/mapping state belong to its caller-owned lifetime. Construction opens no handle and supplies no population cap, concurrent-use guard or automatic round disposal.
// @evidenceExclude contracts/performance.md#efficient-algorithms Initial field setup, nil-context construction and name-generator wiring are upstream printer responsibilities; this adapter chooses no independent initialization or emission strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller controls which printers share a valid emit context, and the upstream printer owns its internal writer and metadata reuse; this constructor coordinates no request cache or shared producer.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewPrinter computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
  return innerprinter.NewPrinter(options, handlers, emitContext)
}

// NewEmitContext allocates a fresh EmitContext for a new emit round.
// The caller owns its lifetime and the node metadata accumulated by the
// round; the context is not guaranteed to be thread-safe.
//
// @evidence contracts/common.md#principled-implementation The upstream constructor initializes the context's own node factory; each call obtains a separate metadata identity for a separate emit round.
// @evidence contracts/common.md#clear-and-simple-design One factory creates the context and its coupled factory together rather than exposing partially initialized emit state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Calls acquire real fresh upstream state rather than sharing a process-global context across unrelated emit rounds.
// @evidence contracts/common.md#meaningful-documentation The comment identifies fresh allocation and its per-round purpose; the context type explains sharing within that round.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned context and its factory reference each other and belong to the caller's emit round; subsequent metadata maps and scope state can retain nodes and provenance until the owning consumers release them. Construction opens no handle and imposes no metadata population cap or automatic round reset.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream constructs the context and factory with their node hooks; this adapter owns no independent allocation or metadata processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Context identity and sharing within an emit round belong to the caller; this factory only requests fresh upstream state and owns no cross-request producer or validity coordinator.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewEmitContext computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewEmitContext() *EmitContext {
  return innerprinter.NewEmitContext()
}

// EmitSourceFile renders the full source file through the printer and returns
// the emitted text.
// The supplied printer must be nonnil and used according to its upstream
// state and handler contract; this adapter adds no concurrent-use guard.
//
// @evidence contracts/common.md#principled-implementation Delegating to the supplied upstream printer preserves AST-aware source emission; callers provide a real source file and a printer constructed for their emit context.
// @evidence contracts/common.md#clear-and-simple-design A single rendering adapter returns text while printer configuration and context construction retain their separate owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source text is produced by compiler AST printing rather than guessed textual substitution or fixture-specific output.
// @evidence contracts/common.md#meaningful-documentation Native prose states full-file rendering and the returned text, distinct from the source-map companion operation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned string retains emitted bytes for its consumers; the borrowed printer owns its reusable writer object and emit context. On normal completion upstream clears the writer's builder, while context and any prior printer state remain caller-owned, with no adapter-owned historical cache or byte cap.
// @evidenceExclude contracts/performance.md#efficient-algorithms AST traversal, source trivia and handler work, and output-byte construction belong to the supplied upstream Printer.Emit path; this adapter chooses no independent emission algorithm, and delegation does not make those input-dependent costs constant.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The supplied printer owns writer reuse and emit context; this adapter coordinates no equivalent requests or completed-output cache and always asks that printer to render the supplied source.
// @evidenceExclude contracts/portability.md#os-neutral-implementation EmitSourceFile computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
  return p.EmitSourceFile(sourceFile)
}

// RangeStartPositionsAreOnSameLine compares two range starts after skipping
// leading trivia in sourceFile. The nonnil file and both nonnegative range
// starts must refer to the same source text, with positions within its bytes.
// Synthesized negative positions are not a supported source-line query.
//
// @evidence contracts/common.md#principled-implementation Upstream trivia skipping and source-line comparison preserve printer layout semantics for both range starts.
// @evidence contracts/common.md#clear-and-simple-design One predicate keeps source-position interpretation with the printer instead of a second line-index implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual source bytes and compiler ranges determine line identity without guessed UTF-16 offsets.
// @evidence contracts/common.md#meaningful-documentation Native prose states trivia handling, nonnil source and shared byte-coordinate premises.
// @evidence contracts/performance.md#bound-retention-and-release-resources When distinct trivia-adjusted positions require a line lookup, upstream can initialize the borrowed source file's locked line-start cache, retaining one entry per line for that source's lifetime. This adapter returns only a boolean and owns no historical state or handle; consumers own source and cache reference release.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns trivia scanning and source-line comparison: adjusted starts can shortcut when equal, otherwise first-use line indexing scans source bytes and line lookup uses binary search. This forwarding adapter chooses no independent scan or indexing strategy, and its constant wrapper size does not bound delegated work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The borrowed source file owns lazy line-map initialization and reuse for its text identity; this adapter coordinates no equivalent requests or additional cache and delegates that same source to upstream.
// @evidenceExclude contracts/portability.md#os-neutral-implementation RangeStartPositionsAreOnSameLine computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func RangeStartPositionsAreOnSameLine(first core.TextRange, second core.TextRange, sourceFile *ast.SourceFile) bool {
  return innerprinter.RangeStartPositionsAreOnSameLine(first, second, sourceFile)
}
