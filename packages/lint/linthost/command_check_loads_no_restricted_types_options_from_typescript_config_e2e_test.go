//go:build e2e

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
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry's failure identity; ordinary Go unit execution does not select this tagged file.
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
