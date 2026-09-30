package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckNoRestrictedImportsUsesRealConfigOptions verifies The in-process check command reads a real JSON rule tuple, reports unsafe once, leaves safe clean and returns status 2 with empty stdout.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check command reads a real JSON rule tuple, reports unsafe once, leaves safe clean and returns status 2 with empty stdout.
// @evidence contracts/testing.md#independent-expectations The fixture policy forbids only unsafe in pkg/* and supplies an independently authored custom message; the literal exit and stream expectations follow check command behavior.
// @evidence contracts/testing.md#distinguishing-cases Two imported names from the same matched module distinguish option loss from whole-module rejection, with a configured message and exact report cardinality.
// @evidence contracts/testing.md#execution-ownership seedLintProject and seedLintConfig materialize the authored fixture. captureCommandOutput directly calls run(check, --cwd, --plugins-json) in the Go process; this Test owns status, streams and configured unsafe/safe diagnostics.
func TestCommandCheckNoRestrictedImportsUsesRealConfigOptions(t *testing.T) {
  root := seedLintProject(t, `import { unsafe, safe } from "pkg/private";
JSON.stringify([unsafe, safe]);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-imports": []any{
        "error",
        map[string]any{
          "patterns": []any{
            map[string]any{
              "group":       []string{"pkg/*"},
              "importNames": []string{"unsafe"},
              "message":     "Import from the public module.",
            },
          },
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  const message = "[no-restricted-imports] 'unsafe' import from 'pkg/private' is restricted from being used by a pattern. Import from the public module."
  if code != 2 || stdout != "" || strings.Count(stderr, message) != 1 || strings.Contains(stderr, "'safe' import") {
    t.Fatalf("no-restricted-imports command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
