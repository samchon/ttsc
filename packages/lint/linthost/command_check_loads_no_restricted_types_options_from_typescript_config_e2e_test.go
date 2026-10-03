//go:build e2e

package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig exercises
// the real config-loader, resolver, engine, and diagnostic-rendering path. A
// severity-only fixture cannot prove the rule receives its structured option map.
//
// @evidence contracts/testing.md#behavioral-verification Exercises run(check) through the actual TypeScript config evaluator, option resolver and native diagnostic renderer; asserts exit 2, empty stdout, the no-restricted-types rule marker and the configured Legacy/Safe message, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations The authored TypeScript config maps Legacy to Use Safe instead., and the source uses that type name. The command asserts the configured message; fixWith and suggest remain input fields whose edit/suggestion results are not asserted here.
// @evidence contracts/testing.md#distinguishing-cases A structured Legacy rule setting and custom message must survive executable configuration rather than only retaining severity. The inferred config object is not an ITtscLintConfig type-surface test; portable rule decisions belong to direct units.
// @evidence contracts/testing.md#execution-ownership nativeLintConnections selects this retained tagged Go entry through GoBoundary.run and supplies the built ttsx launcher. run(check) reaches loadTypeScriptConfigEvaluationWithin, which invokes the actual ttsx/Node config-loader child, consumes its result file and reports through the Go engine. The entry retains its identity and is not selected by ordinary untagged units; it does not certify an installed lint sidecar or completion of the planned shared-consumer migration.
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
