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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the reindents callback body inside indented block fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the call's `=>` header sits at the block indent and the body statements indent exactly two spaces deeper — consistent at every level.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed a `new` call inside a function body whose callback body statements are deliberately mis-indented in the source. The asserted decision is: Assert the call's `=>` header sits at the block indent and the body statements indent exactly two spaces deeper — consistent at every level. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthReindentsCallbackBodyInsideIndentedBlock is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthReindentsCallbackBodyInsideIndentedBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "function boot() {\n  const x = new Singleton(\n() => {\n          register();\n  return x;\n});\n}\n",
    "function boot() {\n  const x = new Singleton(() => {\n    register();\n    return x;\n  });\n}\n",
  )
}
