package ttsc_test

import (
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityStripInvalidCallPatternReportsError verifies strip call patterns
// reject unsupported wildcard placement.
//
// 1. Create a valid TypeScript project.
// 2. Configure strip with an invalid middle wildcard call pattern.
// 3. Assert utility check reports a plugin configuration error.
func TestUtilityStripInvalidCallPatternReportsError(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: no TypeScript diagnostics should interfere with the
	// parseCallPattern validation branch.
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

	// Error assertion: only trailing wildcards are supported by the strip call
	// matcher, so a middle wildcard must stop configuration.
	code, out, errOut := captureUtilityOutput(t, func() int {
		return utility.RunCheck([]string{
			"--cwd", root,
			"--plugins-json", `[{"name":"@ttsc/strip","config":{"calls":["assert.*.fail"]}}]`,
		})
	})
	if code != 2 || out != "" || !strings.Contains(errOut, "wildcard is only supported") {
		t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
}
