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
// The consumer explicitly imports a source file from a sibling directory.
// Format's write-scoped cycle reads the project's selected sources rather than
// the wider imported-source population used for lint reporting. The authored
// full-file expectations preserve the consumer's import and values while
// reflowing its object, and preserve every sibling byte. Package installation
// and package-export resolution are not exercised by this fixture.
//
//  1. Give the consumer and the sibling similarly shaped over-wide objects.
//  2. Run format with `printWidth: 20`, which reflows that literal.
//  3. Assert the consumer was reflowed and the sibling is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with printWidth 20 on a consumer project that imports a sibling package's TypeScript source, where both files hold an over-wide object literal; it requires exit 0 with empty output, the consumer reflowed, and the sibling file byte-identical.
// @evidence contracts/testing.md#independent-expectations Independently authored complete literals require the consumer's import, bindings and values to survive object reflow and the sibling to retain its original bytes. The original positive reflow-line check is also retained.
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
  const consumerWant = "import { legacy } from \"../../api/src/index\";\nexport const own = {\n  aa: legacy,\n  bb: 2,\n  cc: 3,\n};\n"
  if string(formatted) != consumerWant {
    t.Fatalf("consumer source mismatch:\nwant %q\ngot  %q", consumerWant, string(formatted))
  }
  got, err := os.ReadFile(sibling)
  if err != nil {
    t.Fatalf("ReadFile(%s): %v", sibling, err)
  }
  if string(got) != siblingSource {
    t.Fatalf("sibling source was reformatted:\nwant %q\ngot  %q", siblingSource, string(got))
  }
}
