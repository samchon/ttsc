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
// samchon/ttsc#319 is this same class of gap in ttsc's resident serve host:
// tsgo normalizes SourceFile.FileName() by resolving "."/".." segments as
// well as separators. Before this fix, RunTransform built --file's absolute
// form with a native filepath.Join (which does not touch an already-absolute
// path) and findSourceFile compared it with only a filepath.ToSlash swap,
// which never collapses "."/".." — so a syntactically-absolute but
// not-yet-normalized request could fail to match a real project file even
// though it names it correctly. A plain backslash-only path does not
// reproduce this on a Windows test runner (Go's own filepath.ToSlash already
// swaps separators for the host OS there); the "."/".." round-trip is what
// filepath.ToSlash never resolves on any host OS, so it isolates the actual
// gap tspath.NormalizePath/ResolvePath closes.
//
//  1. Create a clean project with one TypeScript source file at src/main.ts.
//  2. Run transform with --file pointing at src/../src/main.ts — the same
//     file, spelled with an unresolved ".." round-trip.
//  3. Assert stdout contains the emitted JavaScript for the requested file.
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
}
