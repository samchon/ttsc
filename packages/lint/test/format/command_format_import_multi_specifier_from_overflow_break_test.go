package linthost

import "testing"

// Verifies a long module tail forces a multi-specifier import to break.
//
// The authored multiline output preserves ShortC, ShortD and the exact module path; it prevents an implementation measuring only the names from passing.
//
// 1. Seed the flat over-wide declaration.
// 2. Run the format command directly in the Go process.
// 3. Assert the complete canonical source.
//
// @evidence contracts/testing.md#behavioral-verification The format command must break an import whose two short names fit but whose module tail makes the declaration over-wide.
// @evidence contracts/testing.md#independent-expectations The authored multiline output preserves ShortC, ShortD and the exact module path; it prevents an implementation measuring only the names from passing.
// @evidence contracts/testing.md#distinguishing-cases This long-tail import complements the long-tail export and already broken negative twins. The assertion is active, not skipped.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatImportMultiSpecifierFromOverflowBreak is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
func TestCommandFormatImportMultiSpecifierFromOverflowBreak(t *testing.T) {
  assertFormatResult(t,
    `import { ShortC, ShortD } from "./very/long/path/here/exceeding/the/eighty/colss";
`,
    `import {
  ShortC,
  ShortD,
} from "./very/long/path/here/exceeding/the/eighty/colss";
`)
}
