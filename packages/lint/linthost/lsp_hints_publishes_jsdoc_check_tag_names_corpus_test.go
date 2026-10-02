package linthost

import (
  "encoding/json"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPHintsPublishesJSDocCheckTagNamesCorpus verifies the real sidecar verb
// carries the built-in tag corpus through command dispatch and JSON.
//
// Direct collection alone would not pin config discovery, Program loading, or
// JSON serialization. This fixture enables the rule in a discovered lint
// config and asks through the same command ttscserver invokes.
//
//  1. Seed a valid TypeScript project with the JSDoc validator enabled.
//  2. Run lsp-hints through the command dispatcher and decode its JSON.
//  3. Assert a representative typed tag retains its trigger and detail.
//
// @evidence contracts/testing.md#behavioral-verification lsp-hints dispatches the configured JSDoc publisher and must include the literal representative typed tag trigger and detail in decoded JSON.
// @evidence contracts/testing.md#independent-expectations The literal param tag, its "accepts a type" detail, the jsdoc scope and the "@" trigger describe the supported completion payload independently of the implementation. The corpus size is only compared with the production knownJSDocTags table, so a tag missing from both the table and the output would not be detected, and tags other than param are not inspected.
// @evidence contracts/testing.md#distinguishing-cases A project with the jsdoc/check-tag-names publisher enabled must return one hint per known tag, including a param hint that keeps its wire metadata; the contrast with a project that declares no publisher is owned by the skip-the-Program test.
// @evidence contracts/testing.md#execution-ownership Calls run lsp-hints in process over a temporary project with captured streams and decodes the JSON hints; no editor or built host is started.
func TestLSPHintsPublishesJSDocCheckTagNamesCorpus(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-hints",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stderr != "" {
    t.Fatalf("lsp-hints mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var hints []publicrule.Hint
  if err := json.Unmarshal([]byte(stdout), &hints); err != nil {
    t.Fatalf("lsp-hints JSON: %v\n%s", err, stdout)
  }
  if len(hints) != len(knownJSDocTags) {
    t.Fatalf("want %d known-tag hints, got %d", len(knownJSDocTags), len(hints))
  }
  for _, hint := range hints {
    if hint.Insert != "param" {
      continue
    }
    if hint.Detail != "accepts a type" || hint.Trigger.Scope != publicrule.HintScopeJSDoc || hint.Trigger.After != "@" {
      t.Fatalf("@param hint lost its wire metadata: %#v", hint)
    }
    return
  }
  t.Fatal("lsp-hints omitted @param")
}
