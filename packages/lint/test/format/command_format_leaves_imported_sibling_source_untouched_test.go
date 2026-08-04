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
