package strip_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandRunsTransform verifies the strip sidecar removes configured calls in transform
// output.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Transform mode is the narrowest host path for receiving mutated TypeScript text. The fixture
// keeps one removable call and one retained statement so the assertion proves selective
// stripping.
//
// 1. Create a source file with a configured strip target.
// 2. Run transform through the real sidecar.
// 3. Decode the JSON payload and assert removed and retained statements separately.
func TestCommandRunsTransform(t *testing.T) {
	// Scenario setup: transform mode observes the in-memory source surface, so no
	// output directory is needed.
	root := seedStripProject(t, false)
	// Transform assertion: the command branch should expose the same in-memory
	// source mutation that build later emits to disk.
	code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+stripManifest(t))
	if code != 0 || stderr != "" {
		t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	var result transformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
		t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
	}
	// Source assertion: the result must include the authored source under the
	// cwd-relative key used by shared utility plugin tests.
	if result.TypeScript["src/main.ts"] == "" {
		t.Fatalf("transform branch did not return project source: %#v", result.TypeScript)
	}
	main := result.TypeScript["src/main.ts"]
	if strings.Contains(main, "debugger") || strings.Contains(main, "console.log") {
		t.Fatalf("transform output was not stripped:\n%s", main)
	}
	if !strings.Contains(main, `export const value = "ok"`) {
		t.Fatalf("transform output did not retain ordinary code:\n%s", main)
	}
}
