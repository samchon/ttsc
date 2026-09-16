package strip_test

import (
  "encoding/json"
  "path/filepath"
  "slices"
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
//  1. Create a minimal project with no config file.
//  2. Invoke transform with a manifest that carries "calls" directly on the
//     plugin entry.
//  3. Assert a non-zero exit, structured recovery metadata without source output,
//     and a diagnostic naming the unsupported key and strip.config.*.
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
    var failure struct {
      TypeScript  map[string]string `json:"typescript"`
      Diagnostics []struct {
        MessageText string `json:"messageText"`
      } `json:"diagnostics"`
      Graph *struct {
        Configs []string `json:"configs"`
      } `json:"graph"`
    }
    if err := json.Unmarshal([]byte(stdout), &failure); err != nil {
      t.Fatalf("key %q: expected structured transform failure: %v; stdout=%q", key, err, stdout)
    }
    if failure.TypeScript == nil || len(failure.TypeScript) != 0 || failure.Graph == nil || !slices.Contains(failure.Graph.Configs, "tsconfig.json") {
      t.Fatalf("key %q: failure must retain recovery metadata without source output: %s", key, stdout)
    }
    if len(failure.Diagnostics) != 1 || !strings.Contains(failure.Diagnostics[0].MessageText, `"`+key+`"`) || !strings.Contains(failure.Diagnostics[0].MessageText, "strip.config") {
      t.Fatalf("key %q: missing structured migration diagnostic: %s", key, stdout)
    }
    if !strings.Contains(stderr, "unsupported key") || !strings.Contains(stderr, `"`+key+`"`) {
      t.Fatalf("key %q: error %q does not mention unsupported key", key, stderr)
    }
    if !strings.Contains(stderr, "strip.config") {
      t.Fatalf("key %q: error %q does not mention strip.config", key, stderr)
    }
  }
}
