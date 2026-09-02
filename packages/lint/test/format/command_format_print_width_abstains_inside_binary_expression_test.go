package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatPrintWidthAbstainsInsideBinaryExpression verifies
// print-width preserves nested reflow targets when it cannot own their binary
// line.
//
// A supported call below an unsupported BinaryExpression otherwise makes its
// width decision in isolation. Broken calls flatten on one pass, the combined
// binary line overflows on the next, and `ttsc format` reaches its 10-pass cap.
// The standalone call is the negative twin: it must still reflow normally.
//
//  1. Seed broken calls below `||`, `??`, and `&&`, a destructuring assignment
//     target below `||`, and one long standalone call.
//  2. Run `ttsc format` twice and require both commands to exit cleanly.
//  3. Assert the binary fragments stay intact and the standalone call reflows.
func TestCommandFormatPrintWidthAbstainsInsideBinaryExpression(t *testing.T) {
  binaryFragments := "export function isStrategy(value: unknown): boolean {\n" +
    "  return isSync(\n" +
    "    value,\n" +
    "  ) || isLazy(\n" +
    "    value,\n" +
    "  ) || isStatic(\n" +
    "    value,\n" +
    "  );\n" +
    "}\n" +
    "const nullable = primary(\n" +
    "  value,\n" +
    ") ?? fallback(\n" +
    "  value,\n" +
    ");\n" +
    "const enabled = isReady(\n" +
    "  value,\n" +
    ") && isAllowed(\n" +
    "  value,\n" +
    ");\n" +
    "([alphaValue, ...remainingValues] = sourceValues) || fallbackValue;\n"
  source := binaryFragments +
    "const formatted = standalone(\"alpha\", \"bravo\", \"charlie\");\n"
  want := binaryFragments +
    "const formatted = standalone(\n" +
    "  \"alpha\",\n" +
    "  \"bravo\",\n" +
    "  \"charlie\",\n" +
    ");\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"printWidth": 40},
  })
  main := filepath.Join(root, "src", "main.ts")

  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{
        "format",
        "--cwd", root,
        "--plugins-json", lintManifest(t),
        "--single-threaded",
      })
    })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("pass %d: format command mismatch: code=%d stdout=%q stderr=%q",
        pass, code, stdout, stderr)
    }
    got, err := os.ReadFile(main)
    if err != nil {
      t.Fatalf("pass %d: ReadFile: %v", pass, err)
    }
    if string(got) != want {
      t.Fatalf("pass %d: reformatted source mismatch:\nwant %q\ngot  %q",
        pass, want, string(got))
    }
  }
}
