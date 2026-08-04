package linthost

import (
  "testing"
)

// TestCommandCheckReportsImportedSiblingWorkspaceSource verifies a file rule
// runs over a sibling workspace source the type-check pass reads.
//
// A pnpm workspace package that publishes `./src/index.ts` as its entry
// resolves to first-party TypeScript in every consumer, so `ttsc` type-checks
// it. Lint used to stop at the consumer's tsconfig file list, which made the
// same invocation hold two views of one Program: the sibling was checked but
// never linted (samchon/ttsc#1065).
//
// 1. Materialize a consumer project importing a sibling package's source.
// 2. Put a no-var violation in the sibling, none in the consumer.
// 3. Run check and assert it fails naming the sibling file.
func TestCommandCheckReportsImportedSiblingWorkspaceSource(t *testing.T) {
  consumer, _ := seedLintSiblingSourceProject(
    t,
    "import { value } from \"../../api/src/index\";\nJSON.stringify(value);\n",
    "var legacy = 1;\nexport const value = legacy;\n",
  )
  seedLintRules(t, consumer, map[string]string{"no-var": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("check mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !diagnosticOutputContains(stderr, "[no-var]") ||
    !diagnosticOutputContains(stderr, "index.ts") {
    t.Fatalf("sibling diagnostic missing from stderr: %q", stderr)
  }
}
