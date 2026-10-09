package e2etrace

import (
  "encoding/json"
  "errors"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCompletionHintsPublicationPreservesTerminalOutcomes Verifies terminal
// observation preserves producer identity, generation, empty success and error.
//
// 1. Leave observation disabled, then enable an owned existing trace root.
// 2. Emit independent literal successful-empty, failed and superseded outcomes.
// 3. Decode the actual sink and require each original terminal field.
//
// @evidence contracts/testing.md#behavioral-verification Calls the real CompletionHintsPublication emitter and reads its actual JSONL sink. Disabled emission leaves the root empty; enabled records preserve each literal outcome, source cwd, producer, generation, hint count and optional error without creating a process or compiler result.
// @evidence contracts/testing.md#independent-expectations Literal terminal states follow the observer contract: published with zero hints is success, run-failed/decode-failed preserve error text, and a superseded store does not claim publication. Expected values are authored independently of encoding.
// @evidence contracts/testing.md#distinguishing-cases Contrasts disabled versus enabled observation, empty and nonempty success, run failure, decode failure and superseded store. Native-source and editor cases separately establish the placement of this emission after the actual operation.
// @evidence contracts/testing.md#execution-ownership Go discovers this direct owning-package unit. It executes the emitter and native filesystem sink with t.TempDir/t.Setenv and no child, installation, plugin build, language server or substituted writer; the test runner owns directory cleanup after synchronous writes close.
func TestCompletionHintsPublicationPreservesTerminalOutcomes(t *testing.T) {
  root := t.TempDir()
  t.Setenv("TTSC_E2E_TRACE", "")
  CompletionHintsPublication("project", "producer", 1, "published", 0, nil)
  entries, err := os.ReadDir(root)
  if err != nil || len(entries) != 0 {
    t.Fatalf("disabled observer wrote evidence: %v %v", entries, err)
  }
  t.Setenv("TTSC_E2E_TRACE", root)
  for _, entry := range []struct {
    outcome string
    hints int
    err error
  }{
    {"published", 0, nil},
    {"published", 2, nil},
    {"run-failed", 0, errors.New("native failed")},
    {"decode-failed", 0, errors.New("invalid JSON")},
    {"superseded", 2, nil},
  } {
    CompletionHintsPublication("project", "producer", 7, entry.outcome, entry.hints, entry.err)
  }
  entries, err = os.ReadDir(root)
  if err != nil || len(entries) != 1 {
    t.Fatalf("observer sink: %v %v", entries, err)
  }
  body, err := os.ReadFile(filepath.Join(root, entries[0].Name()))
  if err != nil { t.Fatal(err) }
  lines := strings.Split(strings.TrimSuffix(string(body), "\n"), "\n")
  expected := []struct{ outcome string; hints float64; err string }{
    {"published", 0, ""}, {"published", 2, ""},
    {"run-failed", 0, "native failed"}, {"decode-failed", 0, "invalid JSON"},
    {"superseded", 2, ""},
  }
  if len(lines) != len(expected) { t.Fatalf("got %d terminal records", len(lines)) }
  for index, line := range lines {
    var record struct {
      Schema int `json:"schema"`
      Event string `json:"event"`
      Cwd string `json:"cwd"`
      Data map[string]any `json:"data"`
    }
    if err := json.Unmarshal([]byte(line), &record); err != nil { t.Fatal(err) }
    want := expected[index]
    if record.Schema != 1 || record.Event != "lsp-hints-publication" || record.Cwd != "project" ||
      record.Data["producer"] != "producer" || record.Data["generation"] != float64(7) ||
      record.Data["outcome"] != want.outcome || record.Data["hints"] != want.hints {
      t.Errorf("terminal %d: %s", index, line)
    }
    if want.err == "" {
      if _, exists := record.Data["error"]; exists { t.Errorf("unexpected terminal error: %s", line) }
    } else if record.Data["error"] != want.err { t.Errorf("terminal error: %s", line) }
  }
}
