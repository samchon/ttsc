package paths_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandRunsTransform verifies the paths sidecar rewrites project sources in transform mode.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Transform mode returns TypeScript source text after in-memory source mutations. This checks
// the host-facing JSON payload rather than internal resolver helpers or build-only emitted
// JavaScript.
//
// 1. Create a project whose source imports through an alias.
// 2. Run transform through the real sidecar.
// 3. Decode the JSON payload and assert the alias became a relative runtime import.
func TestCommandRunsTransform(t *testing.T) {
	// Scenario setup: transform mode does not write to disk, so the project only
	// needs enough structure to load and expose source files.
	root := seedPathsProject(t)
	// Transform assertion: the command contract is the JSON source map returned
	// on stdout after the same source mutation used by build mode.
	code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
	if code != 0 || stderr != "" {
		t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	var result transformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
		t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
	}
	// Source assertion: both importer and target source should be present under
	// cwd-relative keys.
	if result.TypeScript["src/main.ts"] == "" || result.TypeScript["src/lib/message.ts"] == "" {
		t.Fatalf("transform branch did not return project sources: %#v", result.TypeScript)
	}
	main := result.TypeScript["src/main.ts"]
	if strings.Contains(main, "@lib/message") || !strings.Contains(main, `"./lib/message.js"`) {
		t.Fatalf("transform output did not rewrite paths:\n%s", main)
	}
}
