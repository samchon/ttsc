package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsPatternRankingPrefersSpecificPattern verifies paths pattern
// ranking chooses the longest concrete alias before a broader wildcard alias.
//
// Both aliases below can resolve to real files. The only way to choose the
// specific target is for the utility host to rank `@lib/special/*` ahead of
// `@lib/*` before lookup.
//
// 1. Create broad and specific path aliases that both match the same import.
// 2. Emit with the paths utility plugin.
// 3. Assert the generated require path points at the specific target.
func TestUtilityPathsPatternRankingPrefersSpecificPattern(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: both candidate targets exist so this is a ranking test,
  // not a fallback-after-missing-file test.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "rootDir": "src",
    "paths": {
      "@lib/*": ["./src/fallback/*"],
      "@lib/special/*": ["./src/special/*"]
    }
  },
  "files": [
    "src/main.ts",
    "src/fallback/special/value.ts",
    "src/special/value.ts"
  ]
}
`)
  writeProjectFile(t, root, "src/main.ts", `import { value } from "@lib/special/value";
export const result = value;
`)
  writeProjectFile(t, root, "src/fallback/special/value.ts", `export const value = "fallback";
`)
  writeProjectFile(t, root, "src/special/value.ts", `export const value = "specific";
`)

  // Build assertion: the broad alias target would emit
  // ./fallback/special/value.js, so the output path distinguishes the branch.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"@ttsc/paths"}]`,
    })
  })
  if code != 0 {
    t.Fatalf("RunBuild failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  js, err := os.ReadFile(filepath.Join(root, "bin", "main.js"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(js)
  if strings.Contains(text, "@lib/special/value") || !strings.Contains(text, `require("./special/value.js")`) {
    t.Fatalf("paths plugin did not prefer the specific pattern:\n%s", text)
  }
}
