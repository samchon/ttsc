// Package resolutioninputs carries the one recorder of module resolution
// inputs every JavaScript evaluator ttsc caches the result of uses: a plugin
// descriptor's, and a utility plugin's config loader.
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
//
// @evidence contracts/common.md#principled-implementation A caller receives the shared authored recorder source wrapped in a module-local expression rather than another resolution-input implementation.
// @evidence contracts/common.md#clear-and-simple-design A module-local exports object evaluates the embedded recorder without a second implementation or filesystem extraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper uses the recorder's own CommonJS module boundary; it does not mutate a shared loader global or assert that project TypeScript configs support module.exports.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the complete expression and initialization order following the documentation skill.
// @evidence contracts/performance.md#bound-retention-and-release-resources The concatenated expression allocates recorder-sized text returned to the caller; this helper retains no additional cache or native handle and the caller owns the result's lifetime.
// @evidence contracts/performance.md#efficient-algorithms Concatenation copies the current Recorder text plus a fixed wrapper; time and allocation scale with recorder bytes rather than a fixed number of source-level operators.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Recorder is an exported replaceable string, so the helper wraps its current value without owning a historical evaluator or immutable source cache.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This helper assembles JavaScript text only; native evaluation, paths and hook installation belong to its consumer, not this expression builder.
func CommonJSExpression() string {
  return "(function (module) {\n" + Recorder + "\nreturn module.exports;\n})({ exports: {} })"
}
