package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsRewritesRuntimeModuleCalls verifies paths rewriting covers
// runtime module specifier forms beyond static imports.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a project using require, dynamic import, and export specifiers.
// 2. Run the utility build entrypoint with the paths plugin.
// 3. Assert emitted JavaScript no longer contains the tsconfig alias.
func TestUtilityPathsRewritesRuntimeModuleCalls(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: each specifier form maps to the same source file so the
  // visitor must recognize call expressions and export declarations.
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
  writeProjectFile(t, root, "src/main.ts", `declare const require: (name: string) => unknown;
export { value } from "@lib/value";
export const required = require("@lib/value");
export const lazy = import("@lib/value");
`)
  writeProjectFile(t, root, "src/lib/value.ts", `export const value = 1;
`)

  // Build assertion: the runtime output should contain relative specifiers for
  // every live module reference left after TypeScript emit.
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
  if strings.Contains(text, "@lib/value") {
    t.Fatalf("paths plugin left alias in emitted JavaScript:\n%s", text)
  }
  if strings.Count(text, "./lib/value.js") < 3 {
    t.Fatalf("paths plugin did not rewrite all runtime references:\n%s", text)
  }
}
