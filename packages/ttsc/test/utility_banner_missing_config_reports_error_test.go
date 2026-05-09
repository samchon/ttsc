package ttsc_test

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerMissingConfigReportsError verifies the banner plugin fails
// clearly when neither inline text nor a config file exists.
//
// 1. Create a valid project with no banner config file.
// 2. Run the utility check entrypoint with `@ttsc/banner`.
// 3. Assert the command returns a configuration error instead of succeeding.
func TestUtilityBannerMissingConfigReportsError(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: a valid tsconfig keeps the failure focused on banner
	// configuration resolution rather than TypeScript project parsing.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

	// Error assertion: RunCheck must reject the plugin setup before loading a
	// program with an empty preamble.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunCheck([]string{
			"--cwd", root,
			"--plugins-json", `[{"name":"@ttsc/banner"}]`,
		})
	})
	if code != 2 || out != "" || !strings.Contains(errOut, "banner.config") {
		t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
}
