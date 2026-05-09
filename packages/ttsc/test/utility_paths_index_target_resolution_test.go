package ttsc_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsIndexTargetResolution verifies paths rewriting can resolve a
// directory index target from a package-style alias.
//
// 1. Create a project with outDir, rootDir, and an index.ts alias target.
// 2. Import a path alias whose target is an index.ts file.
// 3. Assert emitted JavaScript uses the relative index output path.
func TestUtilityPathsIndexTargetResolution(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the alias maps to a directory, so lookupSource must fall
	// through to the `index.ts` candidate rather than a direct source filename.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "rootDir": "src",
    "paths": {
      "@pkg/*": ["./src/pkg/*"]
    }
  },
  "files": ["src/main.ts", "src/pkg/util/index.ts"]
}
`)
	writeProjectFile(t, root, "src/main.ts", `import { value } from "@pkg/util";
export const result = value;
`)
	writeProjectFile(t, root, "src/pkg/util/index.ts", `export const value = 1;
`)

	// Build assertion: the plugin must resolve the directory index source and
	// compute its emitted JavaScript path from the inferred root.
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
	if strings.Contains(text, "@pkg/util") || !strings.Contains(text, `require("./pkg/util/index.js")`) {
		t.Fatalf("paths plugin did not rewrite inferred index path:\n%s", text)
	}
}
