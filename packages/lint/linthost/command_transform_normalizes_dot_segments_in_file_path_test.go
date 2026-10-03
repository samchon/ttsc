package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandTransformNormalizesDotSegmentsInFilePath verifies transform
// finds the requested file even when --file contains a redundant "dir/../dir"
// round-trip.
//
// The request is deliberately assembled without cleaning its dot segment.
// RunTransform resolves it through tspath before project-source lookup; merely
// swapping host separators would leave the round-trip unresolved. This unit
// observes target emission in the shared process, not a resident serve host.
//
//  1. Create a clean project with one TypeScript source file at src/main.ts.
//  2. Run transform with --file pointing at src/../src/main.ts — the same
//     file, spelled with an unresolved ".." round-trip.
//  3. Assert stdout contains the emitted JavaScript for the requested file.
//
// @evidence contracts/testing.md#behavioral-verification Actual transform accepts a deliberately unresolved src/../src/main.ts absolute spelling and emits the authored exports.value = 1 JavaScript with status zero and empty stderr.
// @evidence contracts/testing.md#independent-expectations The manually appended dot-segment spelling names the independently authored main source; literal emitted assignment verifies actual compiler output rather than comparing two product-normalized paths.
// @evidence contracts/testing.md#distinguishing-cases The path is constructed without cleaning away its dot segment; the ordinary canonical-path sibling supplies the positive spelling control, distinguishing normalization from only host separator handling.
// @evidence contracts/testing.md#execution-ownership Real Go command, project lookup and compiler target emit run in-process with a temporary fixture; native path spelling is input data and no resident daemon, native producer or installed consumer is exercised.
func TestCommandTransformNormalizesDotSegmentsInFilePath(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"no-var": "off"})
  // filepath.Join would clean away the ".." round-trip itself, defeating the
  // point of this fixture, so the dotted segment is appended by hand onto an
  // already-clean base instead of passed through Join.
  sep := string(filepath.Separator)
  dottedFile := filepath.Join(root, "src") + sep + ".." + sep + "src" + sep + "main.ts"
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "transform",
      "--cwd", root,
      "--file", dottedFile,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stderr != "" || !strings.Contains(stdout, "exports.value") {
    t.Fatalf("transform mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stdout, "exports.value = 1;") { t.Fatalf("normalized target lost authored export value: %q", stdout) }
}
