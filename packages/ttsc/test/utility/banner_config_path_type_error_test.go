package ttsc_test

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerConfigPathTypeError verifies the banner `config` option must
// be a non-empty string path.
//
// 1. Create a valid TypeScript project.
// 2. Configure banner with a non-string `config` value.
// 3. Assert utility check rejects the malformed option.
func TestUtilityBannerConfigPathTypeError(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the failure belongs to resolveBannerText before any config
	// file lookup or compiler host work happens.
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

	// Error assertion: malformed JSON shape should produce the banner-specific
	// validation message.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunCheck([]string{
			"--cwd", root,
			"--plugins-json", `[{"name":"@ttsc/banner","config":{"config":123}}]`,
		})
	})
	if code != 2 || out != "" || !strings.Contains(errOut, `"config" must be a non-empty string path`) {
		t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
}
