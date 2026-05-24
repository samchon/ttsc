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

// Tristate is a three-valued boolean: TSFalse, TSTrue, or TSUnknown. Used by
// CompilerOptions fields that can be explicitly unset.
type Tristate = innercore.Tristate

// TextPos is a zero-based byte offset into a source file's text.
type TextPos = innercore.TextPos

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
)

// NewTextRange constructs a closed/open [pos, end) text range.
func NewTextRange(pos, end int) TextRange { return innercore.NewTextRange(pos, end) }

// UndefinedTextRange marks synthesized AST nodes that do not map to source.
func UndefinedTextRange() TextRange { return innercore.UndefinedTextRange() }
