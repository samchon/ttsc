package linthost

import "testing"

// Verifies default-plus-named imports break when over-wide.
//
// The literal multiline output retains Default, the long named binding and the module path, independently of the dispatcher.
//
// 1. Seed the flat over-wide declaration.
// 2. Run the format command directly in the Go process.
// 3. Assert the complete canonical source.
//
// @evidence contracts/testing.md#behavioral-verification The format command must break an over-wide default-plus-named import without losing either binding.
// @evidence contracts/testing.md#independent-expectations The literal multiline output retains Default, the long named binding and the module path, independently of the dispatcher.
// @evidence contracts/testing.md#distinguishing-cases The combined default binding distinguishes this from exempt single-named clauses; canonical already broken default clauses are checked in the stays-inline matrix.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatDefaultImportSingleSpecifierBreak is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
func TestCommandFormatDefaultImportSingleSpecifierBreak(t *testing.T) {
  assertFormatResult(t,
    `import Default, { OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo } from "./m";
`,
    `import Default, {
  OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo,
} from "./m";
`)
}
