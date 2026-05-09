package ttsc_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsRewritesImportSpecifiers verifies the public utility sidecar
// can run the paths plugin through a real project build.
//
// 1. Create a project with TypeScript `paths` mappings and a source import.
// 2. Run the utility build entrypoint with the `@ttsc/paths` plugin.
// 3. Assert emitted JavaScript uses a relative output specifier.
func TestUtilityPathsRewritesImportSpecifiers(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: TypeScript-Go now requires relative targets in `paths`, so
	// the fixture uses `./src/*` entries while importing the package-style alias.
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
	writeProjectFile(t, root, "src/main.ts", `import { value } from "@lib/value";
export const result = value;
`)
	writeProjectFile(t, root, "src/lib/value.ts", `export const value = 1;
`)

	// Build assertion: the utility host applies source transforms before raw
	// emit, so the generated CommonJS require should no longer contain @lib.
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
		t.Fatalf("paths plugin did not rewrite emitted specifier:\n%s", text)
	}
}
