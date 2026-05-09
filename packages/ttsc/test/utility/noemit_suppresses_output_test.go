package ttsc_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityNoEmitSuppressesOutput verifies the utility build entrypoint
// honors `--noEmit` even when plugin configuration is present.
//
// 1. Create a valid project with an outDir.
// 2. Run utility build with `--noEmit`.
// 3. Assert the command succeeds without writing JavaScript output.
func TestUtilityNoEmitSuppressesOutput(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: include a banner plugin so the no-emit path still validates
	// first-party plugin configuration before returning.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

	// No-emit assertion: successful validation must not create the configured
	// output file when the caller requested analysis-only behavior.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunBuild([]string{
			"--cwd", root,
			"--noEmit",
			"--plugins-json", `[{"name":"@ttsc/banner","config":{"text":"Banner"}}]`,
		})
	})
	if code != 0 {
		t.Fatalf("RunBuild --noEmit failed: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
		t.Fatalf("noEmit should not write JavaScript: %v", err)
	}
}
