package ttsc_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerRemoveCommentsSuppressesEmit verifies banner output obeys
// TypeScript's removeComments compiler option.
//
// 1. Create a project with removeComments enabled and a banner plugin.
// 2. Run a real utility build with emit forced on.
// 3. Assert emitted JavaScript does not reinsert the banner after tsgo strips it.
func TestUtilityBannerRemoveCommentsSuppressesEmit(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: source preamble still enters the compiler input, but the
	// output WriteFile hook must stay disabled when removeComments is true.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "removeComments": true
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

	// Build assertion: removeComments owns the final output policy, so the
	// utility host should not restore the banner in makeSourcePreambleWriteFile.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunBuild([]string{
			"--cwd", root,
			"--emit",
			"--plugins-json", `[{"name":"@ttsc/banner","config":{"text":"Removed Banner"}}]`,
		})
	})
	if code != 0 {
		t.Fatalf("RunBuild failed: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(js), "Removed Banner") {
		t.Fatalf("removeComments build unexpectedly retained banner:\n%s", js)
	}
}
