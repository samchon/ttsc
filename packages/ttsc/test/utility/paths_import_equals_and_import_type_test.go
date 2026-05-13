package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsImportEqualsAndImportType verifies paths rewriting visits
// import-equals and import-type module specifiers.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a project using `import = require` and `import("...")` types.
// 2. Run a utility build with the paths plugin.
// 3. Assert emitted JavaScript uses a relative require path.
func TestUtilityPathsImportEqualsAndImportType(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: import-type specifiers are erased from JavaScript but still
  // exercise the AST visitor during source transformation.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "rootDir": "src",
    "paths": {
      "@lib/*": ["./src/lib/*"]
    }
  },
  "files": ["src/main.ts", "src/lib/value.ts"]
}
`)
  writeProjectFile(t, root, "src/main.ts", `import value = require("@lib/value");
type Box = import("@lib/value").Box;
export const result: Box = { value: value.value };
`)
  writeProjectFile(t, root, "src/lib/value.ts", `export interface Box { value: number }
export const value = 1;
`)

  // Build assertion: the live import-equals require should be rewritten, while
  // the import-type path is covered by the transform visitor before erasure.
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
  if strings.Contains(text, "@lib/value") || !strings.Contains(text, `require("./lib/value.js")`) {
    t.Fatalf("paths plugin did not rewrite import-equals output:\n%s", text)
  }
}
