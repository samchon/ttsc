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
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with printWidth 20 on a consumer project that imports a sibling package's TypeScript source, where both files hold an over-wide object literal; it requires exit 0 with empty output, the consumer reflowed, and the sibling file byte-identical.
// @evidence contracts/testing.md#independent-expectations The sibling expectation is its original literal source; the consumer is checked only for containing the reflowed line `\n  aa: legacy,\n`, a partial rather than whole-file comparison.
// @evidence contracts/testing.md#distinguishing-cases The two files are identical in shape, so the only property separating them is ownership: the consumer is inside the project file list and the sibling is only reached through an import. A formatter that rewrote files reachable through imports would change the sibling.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: seeds a two-directory temp workspace and calls run with the format subcommand; no child process, built binary or installed consumer.
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
