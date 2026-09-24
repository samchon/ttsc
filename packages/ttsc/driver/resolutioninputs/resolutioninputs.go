// Package resolutioninputs carries the one recorder of module resolution
// inputs every JavaScript evaluator ttsc caches the result of uses: a plugin
// descriptor's, and a utility plugin's config loader (samchon/ttsc#1501).
//
// A Go plugin that evaluates a JavaScript config file in a Node.js process of
// its own embeds the recorder here instead of carrying a copy: which files a
// resolution read, and which search roots it never reached, is one rule, and
// ttsc's own evaluators read the same file.
package resolutioninputs

import _ "embed"

// Recorder is the CommonJS source of the recorder. It exports
// `createResolutionInputRecorder`, `moduleResolutionBaseSelects`, and
// `visitResolutionCandidates`, and requires nothing but Node.js built-ins, so a
// loader can evaluate it as a module of its own before it installs any
// resolution hook.
//
//go:embed recorder.cjs
var Recorder string

// CommonJSExpression returns a JavaScript expression that evaluates the
// recorder as a module of its own and yields its exports, for a CommonJS
// script a loader feeds Node.js whole: `const R = ` + CommonJSExpression() +
// `;` binds the recorder before the script installs any resolution hook.
func CommonJSExpression() string {
  return "(function (module) {\n" + Recorder + "\nreturn module.exports;\n})({ exports: {} })"
}
