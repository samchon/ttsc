package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsRewriterResolvesIndexAndModuleExtensions verifies alias
// resolution across index files and module-specific source extensions.
//
// The rewriter maps TypeScript source files to emitted JavaScript names. It
// must resolve index targets and preserve `.mts` to `.mjs` output
// mapping when source imports use path aliases.
//
// This scenario converts the private rewriter unit into a public utility build
// fixture. The assertions focus on emitted import specifiers because that is
// the observable contract owned by the package-level test tree.
//
// 1. Build a project with an alias target and known source files.
// 2. Import both an index target and an `.mts` target through the alias.
// 3. Assert resolvable aliases become relative emitted paths.
func TestUtilityPathsRewriterResolvesIndexAndModuleExtensions(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@lib/index": ["./src/modules/index.ts"],
      "@lib/*": ["./src/modules/*.mts"]
    }
  },
  "files": ["src/consumer/main.mts", "src/modules/index.ts", "src/modules/esm.mts"]
}
`)
  writeProjectFile(t, root, "src/consumer/main.mts", `import { value } from "@lib/index";
import { esm } from "@lib/esm";
export const result = value + esm;
`)
  writeProjectFile(t, root, "src/modules/index.ts", `export const value = 1;
`)
  writeProjectFile(t, root, "src/modules/esm.mts", `export const esm = 2;
`)

  code, stdout, stderr := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"@ttsc/paths"}]`,
    })
  })
  if code != 0 {
    t.Fatalf("RunBuild failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  data, err := os.ReadFile(filepath.Join(root, "dist", "consumer", "main.mjs"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(data)
  if strings.Contains(text, "@lib/") ||
    !strings.Contains(text, `"../modules/index.js"`) ||
    !strings.Contains(text, `"../modules/esm.mjs"`) {
    t.Fatalf("paths plugin did not rewrite index and module aliases:\n%s", text)
  }
}
