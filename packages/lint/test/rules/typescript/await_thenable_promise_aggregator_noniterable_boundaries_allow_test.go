package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorNoniterableBoundariesAllow verifies the
// rule leaves missing and non-iterable arguments to the TypeScript checker
// instead of adding an unrelated await-thenable finding.
//
//  1. Suppress compiler errors for a missing and a numeric all argument.
//  2. Run check with typescript/await-thenable enabled as error.
//  3. Assert neither malformed call produces a lint finding.
func TestAwaitThenablePromiseAggregatorNoniterableBoundariesAllow(t *testing.T) {
  root := seedLintProject(t, `// @ts-expect-error: intentionally missing required iterable
Promise.all();
// @ts-expect-error: intentionally non-iterable argument
Promise.all(1);
`)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("malformed Promise aggregator call was linted: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
