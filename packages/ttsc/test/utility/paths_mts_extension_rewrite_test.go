package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsMtsExtensionRewrite verifies paths rewriting preserves the
// emitted `.mjs` extension for `.mts` sources.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create an ES module project with `.mts` source files.
// 2. Run a utility build with the paths plugin.
// 3. Assert the emitted import points at the `.mjs` output file.
func TestUtilityPathsMtsExtensionRewrite(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: emittedJavaScriptExtension must select .mjs instead of the
  // default .js for TypeScript module sources.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "outDir": "bin",
    "rootDir": "src",
    "paths": {
      "@lib/*": ["./src/lib/*.mts"]
    }
  },
  "files": ["src/main.mts", "src/lib/value.mts"]
}
`)
  writeProjectFile(t, root, "src/main.mts", `import { value } from "@lib/value";
export const result = value;
`)
  writeProjectFile(t, root, "src/lib/value.mts", `export const value = 1;
`)

  // Build assertion: ES module emit should retain an import specifier rewritten
  // to the generated .mjs file.
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
  js, err := os.ReadFile(filepath.Join(root, "bin", "main.mjs"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(js)
  if strings.Contains(text, "@lib/value") || !strings.Contains(text, `"./lib/value.mjs"`) {
    t.Fatalf("paths plugin did not rewrite .mts output extension:\n%s", text)
  }
}
