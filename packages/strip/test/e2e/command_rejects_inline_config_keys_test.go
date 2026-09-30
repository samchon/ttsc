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
// @evidence contracts/testing.md#behavioral-verification For calls and statements supplied inline, native transform must fail and return empty source output, one key-specific diagnostic and graph.configs containing tsconfig.json, plus migration guidance on stderr.
// @evidence contracts/testing.md#independent-expectations The file-only strip configuration contract rejects both former inline keys; literal key names and strip.config guidance independently specify the migration failure.
// @evidence contracts/testing.md#distinguishing-cases Both forbidden keys preserve structured recovery metadata instead of output; malformed JSON is a different earlier failure, and file-based success has its own entry.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsInlineConfigKeys entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native failure path must return diagnostic/graph recovery data while refusing transformed sources and exposing the error on stderr. Direct key validation cannot prove that failed-command payload wiring.
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRejectsInlineConfigKeys, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRejectsInlineConfigKeys inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
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
