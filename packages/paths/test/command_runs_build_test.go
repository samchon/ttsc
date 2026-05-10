package paths_test

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandRunsBuild verifies the paths sidecar rewrites aliases during build emit.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Build must preserve the compiler output tree while rewriting import specifiers in files on
// disk. The fixture uses an alias import so the assertion covers emitted JavaScript, not only
// command success.
//
// 1. Create an alias-based TypeScript project with outDir.
// 2. Execute build with --emit through the real sidecar.
// 3. Assert the emitted JavaScript imports the relative output target.
func TestCommandRunsBuild(t *testing.T) {
	// Scenario setup: the shared fixture has rootDir/outDir so the utility host
	// can compute the emitted path for both source and target files.
	root := seedPathsProject(t)
	// Build assertion: --quiet keeps command stdout empty; the emitted JS file
	// is the observable contract for the transform.
	code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--emit", "--quiet")
	if code != 0 || stdout != "" || stderr != "" {
		t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	js := readFile(t, filepath.Join(root, "dist", "main.js"))
	// Output assertion: the authored alias must not leak to runtime output.
	if strings.Contains(js, "@lib/message") || !strings.Contains(js, `require("./lib/message.js")`) {
		t.Fatalf("build output did not rewrite paths:\n%s", js)
	}
}
