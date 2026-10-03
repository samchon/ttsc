package linthost

import (
  "testing"
)

// TestCommandCheckReportsImportedSiblingWorkspaceSource verifies a file rule
// runs over a sibling workspace source the type-check pass reads.
//
// The fixture's tsconfig selects only consumer/src/main.ts. Its explicit
// relative import also brings api/src/index.ts into the Program, and the lint
// source population must include that imported sibling. This entry does not
// install a workspace package or resolve a package-exports entry.
//
// 1. Materialize a consumer project with a relative import of sibling source.
// 2. Put a no-var violation in the sibling, none in the consumer.
// 3. Run check and assert it fails naming the sibling file.
//
// @evidence contracts/testing.md#behavioral-verification Actual check reports no-var and status two for a sibling index.ts imported outside the consumer tsconfig root, while the consumer source is clean and stdout stays empty.
// @evidence contracts/testing.md#independent-expectations Authored sibling-only var violation independently requires the imported source diagnostic; literal rule and index.ts anchors prevent a consumer-only finding from satisfying the expected widened population.
// @evidence contracts/testing.md#distinguishing-cases A sibling source enters through import rather than selection; the noEmit compiler fixture prevents an outside-root emit error from masking lint semantics, and selector controls are covered separately.
// @evidence contracts/testing.md#execution-ownership Real in-process command, JSON config, compiler import resolution and Engine run on temporary sibling fixtures; no package installation, Node evaluator, native plugin producer or CLI process executes.
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
