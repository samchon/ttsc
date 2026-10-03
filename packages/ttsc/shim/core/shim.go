// gen_shims:hand-maintained
//
// Package core re-exports the subset of typescript-go's internal/core types
// and constants that plugins and the ttsc driver need. It provides compiler
// options, script-kind discrimination, tri-state booleans, and text-range
// primitives without exposing the full internal surface.
package core

import (
  innercore "github.com/microsoft/typescript-go/internal/core"
  innersemver "github.com/microsoft/typescript-go/internal/semver"
)

// CompilerOptions holds the parsed tsconfig compiler options passed to the
// TypeScript-Go program host.
//
// @evidence contracts/common.md#principled-implementation A Go alias retains the parsed option fields and upstream tristate types exactly, preserving unset versus explicit false in compiler configuration.
// @evidence contracts/common.md#clear-and-simple-design Hosts pass the compiler's own options value instead of maintaining another option schema and conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration remains caller/compiler data, with no consumer-specific option overrides in this alias.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies parsed tsconfig provenance and the Program-host consumer, separate from these tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CompilerOptions = innercore.CompilerOptions

// JsxEmit is the parsed compilerOptions.jsx mode.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the upstream JSX mode discriminator and the values forwarded by this package's JsxEmit constants.
// @evidence contracts/common.md#clear-and-simple-design One enum identity serves parsed options and compiler consumers without translating JSX modes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Modes use actual compiler constants rather than guessed strings or consumer-selected numeric values.
// @evidence contracts/common.md#meaningful-documentation The comment names the configuration field this discriminator represents.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type JsxEmit = innercore.JsxEmit

// ModuleResolutionKind selects TypeScript-Go's module resolver.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream resolver enum preserves each compiler-supported mode and its identity in CompilerOptions.
// @evidence contracts/common.md#clear-and-simple-design Resolver selection remains one compiler discriminator instead of a parallel shim policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Selection uses upstream constants without guessing a resolver from a consumer name or host OS.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies resolver selection rather than merely repeating the type name.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModuleResolutionKind = innercore.ModuleResolutionKind

// ResolutionMode is the CommonJS or ESM lookup mode for one module use.
//
// @evidence contracts/common.md#principled-implementation The alias preserves per-use CommonJS/ESM discrimination independently from the project's overall module resolution strategy.
// @evidence contracts/common.md#clear-and-simple-design A separate upstream enum expresses the per-module lookup decision without overloading ModuleResolutionKind.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Modes remain compiler facts rather than a file-extension heuristic in the shim.
// @evidence contracts/common.md#meaningful-documentation The comment identifies the per-use scope and the two semantic modes.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ResolutionMode = innercore.ResolutionMode

// Tristate is a three-valued boolean: TSFalse, TSTrue, or TSUnknown. Used by
// CompilerOptions fields that can be explicitly unset.
//
// @evidence contracts/common.md#principled-implementation Go alias identity retains upstream false, true and unknown values, so a boolean conversion cannot erase the distinction used during option merging.
// @evidence contracts/common.md#clear-and-simple-design One three-valued representation serves compiler options instead of separate presence and boolean fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown is retained as a real compiler state rather than being silently coerced to a desired default.
// @evidence contracts/common.md#meaningful-documentation Native prose names the three values and their configuration use before the acknowledgment block.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Tristate = innercore.Tristate

// TextPos is a signed 32-bit byte coordinate. Source offsets are zero-based;
// negative values also represent absent positions for synthesized nodes.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the compiler's integer byte-coordinate representation; it does not reinterpret offsets as UTF-16 character positions.
// @evidence contracts/common.md#clear-and-simple-design A single compiler coordinate type connects source ranges and line starts without a unit-conversion wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Byte offsets are retained without guessed JavaScript character conversion.
// @evidence contracts/common.md#meaningful-documentation The declaration states signed 32-bit storage, zero-based byte units and negative synthetic-position meaning.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TextPos = innercore.TextPos

// ECMALineStarts holds the byte offset of every source line the compiler
// recognizes under ECMAScript's line-terminator rules.
//
// @evidence contracts/common.md#principled-implementation The alias keeps upstream line-start storage and byte-coordinate identity, matching the ComputeECMALineStarts result consumed by compiler location logic.
// @evidence contracts/common.md#clear-and-simple-design Line positions use the compiler's existing representation rather than another indexed line model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source line starts follow compiler semantics rather than a newline split that discards ECMAScript terminators.
// @evidence contracts/common.md#meaningful-documentation Native prose states byte offsets and the language's line-terminator model.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ECMALineStarts = innercore.ECMALineStarts

// TextRange is a half-open [Pos, End) byte range, or an undefined range with
// negative endpoints for a synthesized node.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream range preserves its two byte endpoints and methods, including the undefined range supplied for synthesized nodes.
// @evidence contracts/common.md#clear-and-simple-design One upstream interval representation serves constructors and AST users without a competing span type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Positions stay compiler values without fabricating a source interval for a synthetic node.
// @evidence contracts/common.md#meaningful-documentation Native prose states half-open endpoints and byte units; UndefinedTextRange documents synthesized-node absence.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TextRange = innercore.TextRange

// ScriptKind identifies the syntactic flavour of a source file.
//
// @evidence contracts/common.md#principled-implementation The upstream alias preserves source-language discrimination used by parsing, including TS, JS, JSX/TSX and JSON constants.
// @evidence contracts/common.md#clear-and-simple-design Parsed source flavour uses one compiler enum rather than a shim string-to-language mapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The bridge forwards upstream kinds without special-casing a named file or package.
// @evidence contracts/common.md#meaningful-documentation The comment states syntactic source flavour and adjacent constant comments identify the supported family.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ScriptKind = innercore.ScriptKind

const (
  // TSFalse and TSTrue are the explicit-false and explicit-true Tristate values.
  TSFalse = innercore.TSFalse
  TSTrue  = innercore.TSTrue

  // ScriptKind* constants enumerate the file flavours typescript-go recognises.
  ScriptKindUnknown  = innercore.ScriptKindUnknown
  ScriptKindJS       = innercore.ScriptKindJS
  ScriptKindJSX      = innercore.ScriptKindJSX
  ScriptKindTS       = innercore.ScriptKindTS
  ScriptKindTSX      = innercore.ScriptKindTSX
  ScriptKindExternal = innercore.ScriptKindExternal
  ScriptKindJSON     = innercore.ScriptKindJSON
  ScriptKindDeferred = innercore.ScriptKindDeferred

  // JsxEmit* constants enumerate compilerOptions.jsx modes.
  JsxEmitNone        = innercore.JsxEmitNone
  JsxEmitPreserve    = innercore.JsxEmitPreserve
  JsxEmitReactNative = innercore.JsxEmitReactNative
  JsxEmitReact       = innercore.JsxEmitReact
  JsxEmitReactJSX    = innercore.JsxEmitReactJSX
  JsxEmitReactJSXDev = innercore.JsxEmitReactJSXDev

  // ModuleKind* constants enumerate every configured output module format.
  ModuleKindNone     = innercore.ModuleKindNone
  ModuleKindCommonJS = innercore.ModuleKindCommonJS
  ModuleKindAMD      = innercore.ModuleKindAMD
  ModuleKindUMD      = innercore.ModuleKindUMD
  ModuleKindSystem   = innercore.ModuleKindSystem
  ModuleKindES2015   = innercore.ModuleKindES2015
  ModuleKindES2020   = innercore.ModuleKindES2020
  ModuleKindES2022   = innercore.ModuleKindES2022
  ModuleKindESNext   = innercore.ModuleKindESNext
  ModuleKindNode16   = innercore.ModuleKindNode16
  ModuleKindNode18   = innercore.ModuleKindNode18
  ModuleKindNode20   = innercore.ModuleKindNode20
  ModuleKindNodeNext = innercore.ModuleKindNodeNext
  ModuleKindPreserve = innercore.ModuleKindPreserve

  // ResolutionMode* constants classify a single module-specifier lookup.
  ResolutionModeNone     = innercore.ResolutionModeNone
  ResolutionModeCommonJS = innercore.ResolutionModeCommonJS
  ResolutionModeESM      = innercore.ResolutionModeESM

  // ModuleResolutionKind* constants enumerate every TypeScript-Go resolver.
  ModuleResolutionKindUnknown  = innercore.ModuleResolutionKindUnknown
  ModuleResolutionKindClassic  = innercore.ModuleResolutionKindClassic
  ModuleResolutionKindNode10   = innercore.ModuleResolutionKindNode10
  ModuleResolutionKindNode16   = innercore.ModuleResolutionKindNode16
  ModuleResolutionKindNodeNext = innercore.ModuleResolutionKindNodeNext
  ModuleResolutionKindBundler  = innercore.ModuleResolutionKindBundler
)

// Version reports the TypeScript compiler version typescript-go implements, in
// upstream's compiled version-string form, which can be overridden at link
// time. A graph snapshot publishes this semantic version; it does not identify
// the precise checker revision or certify executable/artifact identity.
//
// @evidence contracts/common.md#principled-implementation Direct delegation returns the version the pinned compiler implements, matching the checker that produced the consumer's semantic facts.
// @evidence contracts/common.md#clear-and-simple-design One accessor supplies upstream version identity without parsing manifests or inferring release metadata.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The answer comes from the compiler rather than a hardcoded ttsc package version.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes compiler version from host release and explains the graph consumer's provenance need.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned string borrows backing storage owned by upstream's process-lifetime compiled version variable. No new file handle, independent buffer or historical result registry is acquired here; callers can retain the string without making this wrapper the version-state owner.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns the direct compiled-string projection. This bridge chooses no independent version computation, parsing or metadata traversal.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Static compiled version state belongs to upstream; this accessor coordinates no completed/in-flight version producer or cache invalidation policy.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This accessor reads compiled version metadata without native filesystem, path-identity or process operations. It does not infer the selected executable's identity or OS capabilities.
func Version() string { return innercore.Version() }

// ApplyDebugStackLimit applies a positive TS_GO_DEBUG_STACK_LIMIT byte count
// to this process's Go runtime. Missing, invalid or nonpositive values do nothing.
// Parsing uses the runtime's int width. A successful call changes process-wide
// stack policy; this wrapper does not restore its previous setting.
//
// @evidence contracts/common.md#principled-implementation Upstream parsing and runtime.SetMaxStack preserve the documented opt-in process-wide limit and invalid-value no-op.
// @evidence contracts/common.md#clear-and-simple-design One explicit operation leaves environment parsing and runtime policy with the compiler owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit upstream operation changes the process-wide stack limit only when its environment input requests a positive limit; no consumer-specific policy is substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose states byte units, process scope and the three no-op conditions.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream may persist a new process-wide runtime stack limit after parsing the environment. No file handle or independent cache is acquired by this bridge, but absence of those resources is not absence of lasting policy state. The runtime and caller own that setting and any later replacement; this adapter provides no scoped restoration.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns environment lookup, integer parsing over the supplied value bytes and runtime policy mutation. This direct bridge chooses no independent lookup/parser/stack-management algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Environment lookup and the explicit runtime setter are not coordinated as completed or in-flight shared work here; the runtime owns its policy state, and this bridge provides no separate producer or memoized setting.
// @evidence contracts/portability.md#os-neutral-implementation Supported os.Getenv and runtime/debug.SetMaxStack obtain the actual process environment and change this Go runtime's policy without OS-name branches or shell interpretation. strconv.Atoi admits only a positive value representable by the runtime's int width; the setting is process-wide rather than a per-call platform capability certificate.
func ApplyDebugStackLimit() { innercore.ApplyDebugStackLimit() }

// TypeScriptVersionSatisfiesRange reports whether the compiler's own version
// satisfies a typesVersions range under TypeScript-Go's semver grammar.
// Invalid range or compiler-version syntax returns false.
//
// @evidence contracts/common.md#principled-implementation Both range and compiler version use upstream semver parsing; the parsed range tests that version, and invalid parsing returns false rather than implying satisfaction.
// @evidence contracts/common.md#clear-and-simple-design One predicate owns range parsing and testing, leaving compiler version production with Version and grammar with upstream semver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts typesVersions matching uses real compiler version and parser semantics rather than consumer names or lexicographic version guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies typesVersions, the upstream grammar and invalid-syntax refusal.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream parsing allocates alternative/comparator and version-component storage for this invocation, potentially retaining substrings until its local values become unreachable. Only a boolean escapes this function; global compiler-version and regex state remain upstream-owned. No independent parse-result history or native handle is retained here, and no fixed input/alternative count cap is imposed.
// @evidence contracts/performance.md#efficient-algorithms Parse the range once, return early when invalid, then parse the actual compiler version once and test it. Delegated regex/tokenization, component parsing and short-circuit alternative/comparator tests scale with supplied range/version text and parsed population; the wrapper's few calls do not make this fixed-cost work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate coordinates no completed/in-flight range-result cache; parsing and matching remain invocation-local while upstream owns static regex and compiler-version state. Caller owners decide whether a result remains equivalent for unchanged range and actual compiler identity.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Matching reads supplied range text and the compiled upstream version string; it performs no native filesystem, path-identity or process operation. Compiler-version metadata is semantic input, not an OS capability query.
func TypeScriptVersionSatisfiesRange(text string) bool {
  versionRange, ok := innersemver.TryParseVersionRange(text)
  if !ok {
    return false
  }
  version, err := innersemver.TryParseVersion(innercore.Version())
  return err == nil && versionRange.Test(&version)
}

// ComputeECMALineStarts applies the compiler's LF, CRLF, CR, LS, and PS line
// model to UTF-8 source text.
//
// @evidence contracts/common.md#principled-implementation Direct delegation applies the compiler's ECMAScript line-terminator scan and returns its byte offsets, preserving CRLF pairing and non-ASCII terminators.
// @evidence contracts/common.md#clear-and-simple-design One text-to-line-start adapter reuses the compiler model without a separate line scanner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation does not approximate compiler lines by splitting only on LF or guessing UTF-16 offsets.
// @evidence contracts/common.md#meaningful-documentation Native prose enumerates LF, CRLF, CR, LS and PS and identifies UTF-8 source units.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream allocates and may grow a line-start backing array; the returned slice keeps that storage reachable under the caller's lifetime. Initial capacity counts LF bytes, so other terminators can require growth. The bridge keeps no independent history cache or handle and imposes no fixed source/line-count cap.
// @evidenceExclude contracts/performance.md#efficient-algorithms The pinned compiler owns the LF-capacity count and ECMAScript byte/rune scan, both over source text, plus line-array append/growth. This direct bridge selects no independent scanner or storage algorithm; fixed-step wrapper syntax does not remove those input-size costs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This bridge does not coordinate a source-version cache or completed/in-flight index producer; compiler and caller owners decide whether an already computed line index can be reused for equivalent text.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ComputeECMALineStarts computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func ComputeECMALineStarts(text string) ECMALineStarts {
  return innercore.ComputeECMALineStarts(text)
}

// NewTextRange constructs a half-open [pos, end) byte range. Endpoints must fit
// signed 32-bit TextPos storage; the constructor does not validate ordering or
// source bounds.
//
// @evidence contracts/common.md#principled-implementation The upstream constructor casts integer endpoints into signed 32-bit TextPos storage, preserving representable values; range ordering, representability and source bounds remain the caller's responsibility.
// @evidence contracts/common.md#clear-and-simple-design One constructor supplies the native range without a separate normalization or coordinate-conversion policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Endpoints are not clamped to manufacture an apparently valid range for a consumer.
// @evidence contracts/common.md#meaningful-documentation Native prose states half-open byte endpoints, signed 32-bit representability and absence of constructor validation, separated from implementation grounds.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewTextRange acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The pinned constructor owns the two endpoint casts and range representation. This direct bridge chooses no separate normalization, traversal or validation algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This scalar range adapter is not a completed/in-flight work producer or cache coordinator; caller operations own reuse of ranges associated with source versions.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewTextRange computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewTextRange(pos, end int) TextRange { return innercore.NewTextRange(pos, end) }

// UndefinedTextRange marks synthesized AST nodes that do not map to source.
//
// @evidence contracts/common.md#principled-implementation Delegation returns the compiler's own undefined-range sentinel, preserving its meaning for synthesized rather than source-backed nodes.
// @evidence contracts/common.md#clear-and-simple-design A named sentinel constructor distinguishes missing source provenance from ordinary NewTextRange intervals.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Synthetic nodes receive upstream absence metadata rather than fabricated source coordinates.
// @evidence contracts/common.md#meaningful-documentation The native comment explains synthesized-node provenance and why an undefined interval exists.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources UndefinedTextRange acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns the scalar undefined-endpoint representation. This direct bridge chooses no independent range algorithm, source traversal or coordinate validation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The sentinel adapter coordinates no completed/in-flight work producer or cache; it supplies scalar absence metadata for caller-owned AST operations.
// @evidenceExclude contracts/portability.md#os-neutral-implementation UndefinedTextRange computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func UndefinedTextRange() TextRange { return innercore.UndefinedTextRange() }
