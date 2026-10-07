package linthost

import "testing"

// TestCommandFormatImportMultiSpecifierFromOverflowBreak verifies a long module
// tail forces a multi-specifier import to break.
//
// The authored multiline output preserves ShortC, ShortD and the exact module path; it prevents an implementation measuring only the names from passing.
//
// 1. Seed the flat over-wide declaration.
// 2. Run the format command directly in the Go process.
// 3. Assert the complete canonical source.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `import { ShortC, ShortD } from "./very/long/path/here/exceeding/the/eighty/colss";` (82 columns) and requires the exact multi-line output with one specifier per line and the module path unchanged.
// @evidence contracts/testing.md#independent-expectations The expected import is an authored literal in the Prettier layout; its two short names fit alone, so only a measurement that includes the module tail produces the break.
// @evidence contracts/testing.md#distinguishing-cases One positive case where the specifier list is short but the module tail pushes the line over 80 columns; no under-width negative twin is in this test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
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
