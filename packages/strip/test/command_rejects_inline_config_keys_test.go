package strip_test

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandRejectsInlineConfigKeys verifies that the strip sidecar rejects
// tsconfig plugin entries containing keys that were formerly used for inline
// configuration (calls, statements).
//
// Locks the unsupported-key guard in loadStripConfigMap so that projects still
// using the old inline shape receive a clear migration error from the Go
// sidecar rather than silently applying defaults. The error must name the
// offending key and direct the user to a strip.config.* file.
//
// 1. Create a minimal project with no config file.
// 2. Invoke transform with a manifest that carries "calls" directly on the
//    plugin entry.
// 3. Assert a non-zero exit and that the error message names the unsupported
//    key and mentions strip.config.*.
func TestCommandRejectsInlineConfigKeys(t *testing.T) {
	root := seedStripProject(t, false)
	for _, key := range []string{"calls", "statements"} {
		manifest := mustJSON(t, []map[string]any{{
			"name":  "@ttsc/strip",
			"stage": "transform",
			"config": map[string]any{
				"transform": "@ttsc/strip",
				key:         []any{"console.log"},
			},
		}})
		code, stdout, stderr := runPlugin(t, "transform",
			"--cwd="+root,
			"--tsconfig="+filepath.Join(root, "tsconfig.json"),
			"--plugins-json="+manifest,
		)
		if code == 0 {
			t.Fatalf("key %q: expected non-zero exit, got 0", key)
		}
		if stdout != "" {
			t.Fatalf("key %q: expected empty stdout, got %q", key, stdout)
		}
		if !strings.Contains(stderr, "unsupported key") || !strings.Contains(stderr, `"`+key+`"`) {
			t.Fatalf("key %q: error %q does not mention unsupported key", key, stderr)
		}
		if !strings.Contains(stderr, "strip.config") {
			t.Fatalf("key %q: error %q does not mention strip.config", key, stderr)
		}
	}
}
