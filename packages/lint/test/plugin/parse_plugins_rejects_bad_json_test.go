package linthost

import (
  "strings"
  "testing"
)

// TestParsePluginsRejectsBadJSON verifies ParsePlugins returns an error when
// the payload is not valid JSON.
//
// The native sidecar receives --plugins-json from ttsc over a subprocess
// argument. A corrupted or truncated argument must not silently fall through
// to an empty rule set; the error message must also mention "plugins-json" so
// the user can tell the failure came from the plugin manifest rather than from
// rule config.
//
// 1. Pass the non-JSON string "not-json" to ParsePlugins.
// 2. Assert a non-nil error is returned.
// 3. Assert the error message contains "invalid --plugins-json".
func TestParsePluginsRejectsBadJSON(t *testing.T) {
  if _, err := ParsePlugins("not-json"); err == nil {
    t.Error("expected error for malformed JSON")
  } else if !strings.Contains(err.Error(), "invalid --plugins-json") {
    t.Errorf("error should mention plugins-json: %v", err)
  }
}
