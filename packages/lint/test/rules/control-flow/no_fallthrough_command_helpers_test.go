package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// assertNoFallthroughCommandMarkers runs the complete check command path and
// expects one no-fallthrough diagnostic at every source line carrying the
// trailing marker "// diagnostic". Placing the marker after a case label keeps
// it outside the preceding clause's eligible fallthrough-comment trivia.
func assertNoFallthroughCommandMarkers(t *testing.T, source string) {
  t.Helper()
  assertNoFallthroughCommandMarkersForFile(t, "main.ts", source)
}

func assertNoFallthroughCommandMarkersForFile(t *testing.T, fileName, source string) {
  t.Helper()
  expectedLines := make([]int, 0)
  for index, line := range strings.Split(source, "\n") {
    if strings.Contains(line, "// diagnostic") {
      expectedLines = append(expectedLines, index+1)
    }
  }

  root := seedLintProjectFile(t, fileName, source)
  seedLintRules(t, root, map[string]string{"no-fallthrough": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })

  expectedCode := 0
  if len(expectedLines) > 0 {
    expectedCode = 2
  }
  if code != expectedCode || stdout != "" {
    t.Fatalf("command result mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if count := strings.Count(stderr, "[no-fallthrough]"); count != len(expectedLines) {
    t.Fatalf("expected %d no-fallthrough diagnostics, got %d: %s", len(expectedLines), count, stderr)
  }
  for _, line := range expectedLines {
    location := fmt.Sprintf("%s:%d:", fileName, line)
    if !diagnosticOutputContains(stderr, location) {
      t.Fatalf("missing no-fallthrough diagnostic at %s: %s", location, stderr)
    }
  }
}
