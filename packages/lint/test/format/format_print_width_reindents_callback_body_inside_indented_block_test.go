package linthost

import "testing"

// TestFormatPrintWidthReindentsCallbackBodyInsideIndentedBlock verifies
// a callback call nested inside an indented block reflows with the
// callback body indented relative to the call's own line, not relative
// to wherever the body bytes started in the source.
//
// This is the inconsistent-indentation regression. A verbatim callback
// body kept the absolute source columns of its lines, so when the call
// sat inside a function body the re-indent re-anchored the `() =>`
// header but left the body lines stranded — header at one indent, body
// at another. The block printer now re-emits every statement at the
// engine-controlled indent, so the body lands two spaces under the
// header regardless of how the source was indented.
//
//  1. Feed a `new` call inside a function body whose callback body
//     statements are deliberately mis-indented in the source.
//  2. Run formatPrintWidth at the default width.
//  3. Assert the call's `=>` header sits at the block indent and the
//     body statements indent exactly two spaces deeper — consistent at
//     every level.
func TestFormatPrintWidthReindentsCallbackBodyInsideIndentedBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatPrintWidth",
    "function boot() {\n  const x = new Singleton(\n() => {\n          register();\n  return x;\n});\n}\n",
    "function boot() {\n  const x = new Singleton(() => {\n    register();\n    return x;\n  });\n}\n",
  )
}
