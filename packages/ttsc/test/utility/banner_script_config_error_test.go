package ttsc_test

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerScriptConfigError verifies script config loader failures are
// surfaced with the banner plugin context.
//
// 1. Create a project with a throwing banner.config.cjs.
// 2. Run the banner plugin through utility check.
// 3. Assert stderr includes the loader failure text.
func TestUtilityBannerScriptConfigError(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the config filename is valid, so the failure comes from
	// loadBannerScriptConfigFile executing the script.
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
	writeProjectFile(t, root, "banner.config.cjs", `throw new Error("banner exploded");
`)

	// Error assertion: the command should preserve the plugin name and script
	// exception message for config debugging.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunCheck([]string{
			"--cwd", root,
			"--plugins-json", `[{"name":"@ttsc/banner"}]`,
		})
	})
	if code != 2 || out != "" || !strings.Contains(errOut, "banner exploded") {
		t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
}
