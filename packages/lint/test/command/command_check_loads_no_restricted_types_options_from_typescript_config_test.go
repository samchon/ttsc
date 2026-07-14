package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckLoadsNoRestrictedTypesOptionsFromTypeScriptConfig exercises
// the real config-loader, resolver, engine, and diagnostic-rendering path. A
// severity-only fixture cannot prove the rule receives its typed option map.
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
