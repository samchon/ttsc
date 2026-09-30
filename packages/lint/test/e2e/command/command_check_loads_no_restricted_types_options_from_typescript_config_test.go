package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig exercises
// the real config-loader, resolver, engine, and diagnostic-rendering path. A
// severity-only fixture cannot prove the rule receives its typed option map.
//
// @evidence contracts/testing.md#behavioral-verification Exercises run(check) through the actual TypeScript config evaluator, option resolver and native diagnostic renderer; asserts exit 2, empty stdout, the no-restricted-types rule marker and the configured Legacy/Safe message, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations The literal TypeScript config maps Legacy to a replacement message, fix and suggestion; the type alias in source independently establishes the banned name.
// @evidence contracts/testing.md#distinguishing-cases This case owns typed rule options survive executable configuration instead of merely preserving severity; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig is discovered from test/e2e by the flattened lint runner and called once under TestSelectedLintBoundaries; its named subcases retain inputs, assertions and failure identity.
// @evidence contracts/e2e.md#necessary-boundary The actual connection is run(check) through the actual TypeScript config evaluator, option resolver and native diagnostic renderer; direct native operation calls cannot prove that separate evaluator, formatter, binary-stdin or JavaScript runtime behavior.
// @evidence contracts/e2e.md#shared-execution The flattened Go boundary harness is built once; this isolated executable config needs one evaluator request because its project, module origin and option values define the connection.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the project; captureCommandOutput owns temporary streams and the evaluator owns its child/scratch lifetime. The config has no changed dependencies or cross-case reusable answer.
// @evidence contracts/e2e.md#preserved-coverage Keeps exit 2, empty stdout, the no-restricted-types rule marker and the configured Legacy/Safe message and every original input/control branch; preparation sharing changes no expected result or admitted case.
func TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig(t *testing.T) {
  root := seedLintProject(t, "type Legacy = string;\nconst value: Legacy = \"value\";\nJSON.stringify(value);\n")
  writeFile(t, filepath.Join(root, "ttsc-lint.config.ts"), `const config = {
  rules: {
    "typescript/no-restricted-types": [
      "error",
      {
        types: {
          Legacy: {
            message: "Use Safe instead.",
            fixWith: "Safe",
            suggest: ["Safer"],
          },
        },
      },
    ],
  },
};
export default config;
`)
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifestWithConfig(t, map[string]any{
        "configFile": "./ttsc-lint.config.ts",
      }),
    })
  })
  if code != 2 || stdout != "" ||
    !diagnosticOutputContains(stderr, "[typescript/no-restricted-types]") ||
    !strings.Contains(stderr, "Don't use `Legacy` as a type. Use Safe instead.") {
    t.Fatalf("check diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
