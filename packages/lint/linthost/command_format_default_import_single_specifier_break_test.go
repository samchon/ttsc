package linthost

import "testing"

// TestCommandFormatDefaultImportSingleSpecifierBreak verifies a default import
// with one named specifier breaks the braces when the declaration is over-wide.
//
// The literal multiline output retains Default, the long named binding and the module path, independently of the dispatcher.
//
// 1. Seed the flat over-wide declaration.
// 2. Run the format command directly in the Go process.
// 3. Assert the complete canonical source.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `import Default, { <one long binding> } from "./m";` that exceeds 80 columns and requires the exact output with the named binding on its own indented line inside the braces and the `Default` binding and module path intact.
// @evidence contracts/testing.md#independent-expectations The expected multi-line import is an authored literal in the Prettier layout for a default binding plus one named binding; nothing is computed from formatter output.
// @evidence contracts/testing.md#distinguishing-cases One positive case: a single named specifier next to a default import must still break when over-wide. A single-named import without a default binding (which must not break) and under-width inputs are not covered by this test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatDefaultImportSingleSpecifierBreak(t *testing.T) {
  assertFormatResult(t,
    `import Default, { OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo } from "./m";
`,
    `import Default, {
  OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo,
} from "./m";
`)
}
