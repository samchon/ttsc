// gen_shims:hand-maintained
//
// Package core re-exports the subset of typescript-go's internal/core types
// and constants that plugins and the ttsc driver need. It provides compiler
// options, script-kind discrimination, tri-state booleans, and text-range
// primitives without exposing the full internal surface.
package core

import innercore "github.com/microsoft/typescript-go/internal/core"

// CompilerOptions holds the parsed tsconfig compiler options passed to the
// TypeScript-Go program host.
type CompilerOptions = innercore.CompilerOptions

// JsxEmit is the parsed compilerOptions.jsx mode.
type JsxEmit = innercore.JsxEmit

// ModuleResolutionKind selects TypeScript-Go's module resolver.
type ModuleResolutionKind = innercore.ModuleResolutionKind

// ResolutionMode is the CommonJS or ESM lookup mode for one module use.
type ResolutionMode = innercore.ResolutionMode

// Tristate is a three-valued boolean: TSFalse, TSTrue, or TSUnknown. Used by
// CompilerOptions fields that can be explicitly unset.
type Tristate = innercore.Tristate

// TextPos is a zero-based byte offset into a source file's text.
type TextPos = innercore.TextPos

// ECMALineStarts holds the byte offset of every source line the compiler
// recognizes under ECMAScript's line-terminator rules.
type ECMALineStarts = innercore.ECMALineStarts

// TextRange is a half-open [Pos, End) byte range inside a source file.
type TextRange = innercore.TextRange

// ScriptKind identifies the syntactic flavour of a source file.
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
func Version() string { return innercore.Version() }

// ComputeECMALineStarts applies the compiler's LF, CRLF, CR, LS, and PS line
// model to UTF-8 source text.
func ComputeECMALineStarts(text string) ECMALineStarts {
  return innercore.ComputeECMALineStarts(text)
}

// NewTextRange constructs a closed/open [pos, end) text range.
func NewTextRange(pos, end int) TextRange { return innercore.NewTextRange(pos, end) }

// UndefinedTextRange marks synthesized AST nodes that do not map to source.
func UndefinedTextRange() TextRange { return innercore.UndefinedTextRange() }
