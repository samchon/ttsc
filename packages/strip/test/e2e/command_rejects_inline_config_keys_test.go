//go:build e2e

package strip_test

import (
  "encoding/json"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
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
// @evidence contracts/testing.md#distinguishing-cases Both former inline keys (calls, statements) are tried against one project and each must fail with an empty typescript map plus graph.configs. No success route and no malformed-JSON route is run in this body; file-based success belongs to command_loads_config_from_file.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsInlineConfigKeys entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native failure path must return diagnostic/graph recovery data while refusing transformed sources and exposing the error on stderr. Direct key validation cannot prove that failed-command payload wiring.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts two transform processes, one per forbidden key, from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedStripProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; one project is seeded before the loop and both transform processes read it without writing to it (transform emits to stdout), so no state passes between iterations. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The non-zero status, structured failure envelope, single key-specific diagnostic and the stderr key/strip.config checks are all made in this body for each of the two keys; nothing is delegated elsewhere.
func TestCommandRejectsInlineConfigKeys(t *testing.T) {
  root := seedStripProject(t, false)
  for _, key := range []string{"calls", "statements"} {
    manifest := shared.MustJSON(t, []map[string]any{{
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
