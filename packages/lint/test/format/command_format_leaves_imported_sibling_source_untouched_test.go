package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatLeavesImportedSiblingSourceUntouched verifies format stays
// inside the project it was invoked for.
//
// Format is write-only and prints nothing, so it walks its own file list rather
// than the wider set the lint cycle reads: a sibling workspace package resolving
// to source is in the same Program, but reformatting it would rewrite files this
// project does not own. That is the one boundary samchon/ttsc#1065 asks to keep
// closed while the reporting side opens, and it is enforced by what format reads
// rather than by discarding findings afterwards.
//
//  1. Give the consumer and the sibling the identical over-wide object literal.
//  2. Run format with `printWidth: 20`, which reflows that literal.
//  3. Assert the consumer was reflowed and the sibling is byte-identical.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises leaves imported sibling source untouched and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the consumer was reflowed and the sibling is byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Give the consumer and the sibling the identical over-wide object literal. The asserted decision is: Assert the consumer was reflowed and the sibling is byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatLeavesImportedSiblingSourceUntouched owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatLeavesImportedSiblingSourceUntouched(t *testing.T) {
  const siblingSource = "export const legacy = { aa: 1, bb: 2, cc: 3 };\n"
  consumer, sibling := seedLintSiblingSourceProject(
    t,
    "import { legacy } from \"../../api/src/index\";\nexport const own = { aa: legacy, bb: 2, cc: 3 };\n",
    siblingSource,
  )
  seedLintConfig(t, consumer, map[string]any{
    "format": map[string]any{"printWidth": 20},
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  formatted, err := os.ReadFile(filepath.Join(consumer, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if !strings.Contains(string(formatted), "\n  aa: legacy,\n") {
    t.Fatalf("consumer source was not reflowed: %q", string(formatted))
  }
  got, err := os.ReadFile(sibling)
  if err != nil {
    t.Fatalf("ReadFile(%s): %v", sibling, err)
  }
  if string(got) != siblingSource {
    t.Fatalf("sibling source was reformatted:\nwant %q\ngot  %q", siblingSource, string(got))
  }
}
