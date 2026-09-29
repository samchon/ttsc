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
type CompilerOptions = innercore.CompilerOptions

// JsxEmit is the parsed compilerOptions.jsx mode.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the upstream JSX mode discriminator and the values forwarded by this package's JsxEmit constants.
// @evidence contracts/common.md#clear-and-simple-design One enum identity serves parsed options and compiler consumers without translating JSX modes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Modes use actual compiler constants rather than guessed strings or consumer-selected numeric values.
// @evidence contracts/common.md#meaningful-documentation The comment names the configuration field this discriminator represents.
type JsxEmit = innercore.JsxEmit

// ModuleResolutionKind selects TypeScript-Go's module resolver.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream resolver enum preserves each compiler-supported mode and its identity in CompilerOptions.
// @evidence contracts/common.md#clear-and-simple-design Resolver selection remains one compiler discriminator instead of a parallel shim policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Selection uses upstream constants without guessing a resolver from a consumer name or host OS.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies resolver selection rather than merely repeating the type name.
type ModuleResolutionKind = innercore.ModuleResolutionKind

// ResolutionMode is the CommonJS or ESM lookup mode for one module use.
//
// @evidence contracts/common.md#principled-implementation The alias preserves per-use CommonJS/ESM discrimination independently from the project's overall module resolution strategy.
// @evidence contracts/common.md#clear-and-simple-design A separate upstream enum expresses the per-module lookup decision without overloading ModuleResolutionKind.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Modes remain compiler facts rather than a file-extension heuristic in the shim.
// @evidence contracts/common.md#meaningful-documentation The comment identifies the per-use scope and the two semantic modes.
type ResolutionMode = innercore.ResolutionMode

// Tristate is a three-valued boolean: TSFalse, TSTrue, or TSUnknown. Used by
// CompilerOptions fields that can be explicitly unset.
//
// @evidence contracts/common.md#principled-implementation Go alias identity retains upstream false, true and unknown values, so a boolean conversion cannot erase the distinction used during option merging.
// @evidence contracts/common.md#clear-and-simple-design One three-valued representation serves compiler options instead of separate presence and boolean fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown is retained as a real compiler state rather than being silently coerced to a desired default.
// @evidence contracts/common.md#meaningful-documentation Native prose names the three values and their configuration use before the acknowledgment block.
type Tristate = innercore.Tristate

// TextPos is a signed 32-bit byte coordinate. Source offsets are zero-based;
// negative values also represent absent positions for synthesized nodes.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the compiler's integer byte-coordinate representation; it does not reinterpret offsets as UTF-16 character positions.
// @evidence contracts/common.md#clear-and-simple-design A single compiler coordinate type connects source ranges and line starts without a unit-conversion wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Byte offsets are retained without guessed JavaScript character conversion.
// @evidence contracts/common.md#meaningful-documentation The declaration states signed 32-bit storage, zero-based byte units and negative synthetic-position meaning.
type TextPos = innercore.TextPos

// ECMALineStarts holds the byte offset of every source line the compiler
// recognizes under ECMAScript's line-terminator rules.
//
// @evidence contracts/common.md#principled-implementation The alias keeps upstream line-start storage and byte-coordinate identity, matching the ComputeECMALineStarts result consumed by compiler location logic.
// @evidence contracts/common.md#clear-and-simple-design Line positions use the compiler's existing representation rather than another indexed line model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source line starts follow compiler semantics rather than a newline split that discards ECMAScript terminators.
// @evidence contracts/common.md#meaningful-documentation Native prose states byte offsets and the language's line-terminator model.
type ECMALineStarts = innercore.ECMALineStarts

// TextRange is a half-open [Pos, End) byte range, or an undefined range with
// negative endpoints for a synthesized node.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream range preserves its two byte endpoints and methods, including the undefined range supplied for synthesized nodes.
// @evidence contracts/common.md#clear-and-simple-design One upstream interval representation serves constructors and AST users without a competing span type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Positions stay compiler values without fabricating a source interval for a synthetic node.
// @evidence contracts/common.md#meaningful-documentation Native prose states half-open endpoints and byte units; UndefinedTextRange documents synthesized-node absence.
type TextRange = innercore.TextRange

// ScriptKind identifies the syntactic flavour of a source file.
//
// @evidence contracts/common.md#principled-implementation The upstream alias preserves source-language discrimination used by parsing, including TS, JS, JSX/TSX and JSON constants.
// @evidence contracts/common.md#clear-and-simple-design Parsed source flavour uses one compiler enum rather than a shim string-to-language mapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The bridge forwards upstream kinds without special-casing a named file or package.
// @evidence contracts/common.md#meaningful-documentation The comment states syntactic source flavour and adjacent constant comments identify the supported family.
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
// the same form `tsc --version` prints. A graph snapshot publishes it so a
// consumer can tell which checker resolved the facts it is reading.
//
// @evidence contracts/common.md#principled-implementation Direct delegation returns the version the pinned compiler implements, matching the checker that produced the consumer's semantic facts.
// @evidence contracts/common.md#clear-and-simple-design One accessor supplies upstream version identity without parsing manifests or inferring release metadata.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The answer comes from the compiler rather than a hardcoded ttsc package version.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes compiler version from host release and explains the graph consumer's provenance need.
func Version() string { return innercore.Version() }

// TypeScriptVersionSatisfiesRange reports whether the compiler's own version
// satisfies a typesVersions range under TypeScript-Go's semver grammar.
// Invalid range or compiler-version syntax returns false.
//
// @evidence contracts/common.md#principled-implementation Both range and compiler version use upstream semver parsing; the parsed range tests that version, and invalid parsing returns false rather than implying satisfaction.
// @evidence contracts/common.md#clear-and-simple-design One predicate owns range parsing and testing, leaving compiler version production with Version and grammar with upstream semver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts typesVersions matching uses real compiler version and parser semantics rather than consumer names or lexicographic version guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies typesVersions, the upstream grammar and invalid-syntax refusal.
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
func NewTextRange(pos, end int) TextRange { return innercore.NewTextRange(pos, end) }

// UndefinedTextRange marks synthesized AST nodes that do not map to source.
//
// @evidence contracts/common.md#principled-implementation Delegation returns the compiler's own undefined-range sentinel, preserving its meaning for synthesized rather than source-backed nodes.
// @evidence contracts/common.md#clear-and-simple-design A named sentinel constructor distinguishes missing source provenance from ordinary NewTextRange intervals.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Synthetic nodes receive upstream absence metadata rather than fabricated source coordinates.
// @evidence contracts/common.md#meaningful-documentation The native comment explains synthesized-node provenance and why an undefined interval exists.
func UndefinedTextRange() TextRange { return innercore.UndefinedTextRange() }
