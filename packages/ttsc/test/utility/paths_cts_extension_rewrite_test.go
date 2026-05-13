package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsCtsExtensionRewrite verifies paths rewriting maps `.cts`
// source targets to `.cjs` emitted module specifiers.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a NodeNext project with a path alias to a `.cts` source file.
// 2. Emit with the paths utility plugin.
// 3. Assert the generated CommonJS file imports the `.cjs` output target.
func TestUtilityPathsCtsExtensionRewrite(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: using `.cts` on both the importer and target keeps the
  // emitted files in the CommonJS module lane.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2022",
    "outDir": "bin",
    "rootDir": "src",
    "paths": {
      "@server/*": ["./src/server/*.cts"]
    }
  },
  "files": ["src/main.cts", "src/server/config.cts"]
}
`)
  writeProjectFile(t, root, "src/main.cts", `import { value } from "@server/config";

export = value;
`)
  writeProjectFile(t, root, "src/server/config.cts", `export const value = 1;
`)

  // Build assertion: `.cts` should not be rewritten to `.js` because Node will
  // load the emitted target as `.cjs`.
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
  js, err := os.ReadFile(filepath.Join(root, "bin", "main.cjs"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(js)
  if strings.Contains(text, "@server/config") || !strings.Contains(text, `require("./server/config.cjs")`) {
    t.Fatalf("paths plugin did not rewrite .cts target to .cjs:\n%s", text)
  }
}
