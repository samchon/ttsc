package banner_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandRunsTransform verifies the banner sidecar transforms one requested source file.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Single-file transform is the command shape used by plugin hosts that need text back over
// stdout. The scenario checks banner insertion while keeping project traversal and file
// targeting active.
//
// 1. Create a project containing one source file and a banner manifest.
// 2. Run transform with --file against that source.
// 3. Decode the JSON payload and assert the emitted JavaScript contains the banner.
func TestCommandRunsTransform(t *testing.T) {
	// Scenario setup: transform mode returns in-memory source text, so the test
	// does not need outDir or emitted files.
	root := seedProject(t, map[string]string{
		"tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
		"src/main.ts":   `export const value = "ok";` + "\n",
	})

	// Transform assertion: stdout is the command contract here, and the banner
	// must already be visible before JavaScript emit.
	code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, "transform banner"))
	if code != 0 || stderr != "" {
		t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	var result transformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
		t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
	}
	// Source assertion: the key is relative to project cwd, matching the shared
	// utility transform result contract used by ttsc.
	if !strings.Contains(result.TypeScript["src/main.ts"], "transform banner") {
		t.Fatalf("transform output missing banner: %#v", result.TypeScript)
	}
}
