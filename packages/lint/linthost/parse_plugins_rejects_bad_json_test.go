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
//
// @evidence contracts/testing.md#behavioral-verification Actual ParsePlugins rejects not-json and reports invalid --plugins-json context instead of silently treating malformed descriptors as absent.
// @evidence contracts/testing.md#independent-expectations The authored string is not JSON; required contextual error text is specified literally by the host descriptor diagnostic contract, independently of json.Unmarshal output.
// @evidence contracts/testing.md#distinguishing-cases Malformed nonblank input contrasts with accepted whitespace-only and valid populated payloads in sibling tests, distinguishing corruption from descriptor absence.
// @evidence contracts/testing.md#execution-ownership The actual descriptor decoder runs directly in-process; this unit owns error semantics, not native subprocess transport or producer compilation.
func TestParsePluginsRejectsBadJSON(t *testing.T) {
  if _, err := ParsePlugins("not-json"); err == nil {
    t.Error("expected error for malformed JSON")
  } else if !strings.Contains(err.Error(), "invalid --plugins-json") {
    t.Errorf("error should mention plugins-json: %v", err)
  }
}
