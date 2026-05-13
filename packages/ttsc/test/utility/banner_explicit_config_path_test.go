package ttsc_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerExplicitConfigPath verifies banner config paths are resolved
// relative to the selected tsconfig file, not blindly from process cwd.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a nested tsconfig with a sibling banner config file.
// 2. Run the utility transform entrypoint with an explicit `config` value.
// 3. Assert the resolved config text is injected into the nested source file.
func TestUtilityBannerExplicitConfigPath(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the cwd and tsconfig directory intentionally differ so
  // resolveBannerConfigPath must use the tsconfig base directory.
  writeProjectFile(t, root, "app/tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "app/index.ts", `export const value = 1;
`)
  writeProjectFile(t, root, "app/banner.config.cjs", `module.exports = "Explicit Config Banner";
`)
  plugins := `[{"name":"@ttsc/banner","config":{"config":"banner.config.cjs"}}]`

  // Transform assertion: the output key is still relative to cwd, while the
  // config lookup must be relative to app/tsconfig.json.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--tsconfig", "app/tsconfig.json",
      "--plugins-json", plugins,
    })
  })
  if code != 0 {
    t.Fatalf("RunTransform failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var transformed utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
    t.Fatalf("RunTransform JSON decode failed: %v\nstdout=%s\nstderr=%s", err, out, errOut)
  }
  if !strings.Contains(transformed.TypeScript["app/index.ts"], "Explicit Config Banner") {
    t.Fatalf("explicit banner config was not injected: %#v", transformed.TypeScript)
  }
}
