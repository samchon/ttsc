package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBuildAppliesLinkedSourcePreamble verifies linked source-preamble
// plugins affect emitted JavaScript during utility build.
//
// Declaration files may not carry the original parsed source text, so the
// utility host wraps tsgo's write callback and applies the preamble to
// every emitted file kind that the plugin targets.
//
// 1. Register a linked source-preamble plugin.
// 2. Run utility build with emit enabled and one manifest entry.
// 3. Assert the generated JavaScript contains the preamble text.
func TestUtilityBuildAppliesLinkedSourcePreamble(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(utilityPreamblePlugin{})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "declaration": true,
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"pre","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunBuild mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(js), "utility linked preamble") {
    t.Fatalf("preamble missing from JavaScript:\n%s", js)
  }
}
