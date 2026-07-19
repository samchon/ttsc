package linthost

import (
  "encoding/json"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPHintsPublishesJSDocCheckTagNamesCorpus verifies the real sidecar verb
// carries the built-in tag corpus across the process boundary.
//
// Direct collection alone would not pin config discovery, Program loading, or
// JSON serialization. This fixture enables the rule in a discovered lint
// config and asks through the same command ttscserver invokes.
//
//  1. Seed a valid TypeScript project with the JSDoc validator enabled.
//  2. Run lsp-hints through the command dispatcher and decode its JSON.
//  3. Assert a representative typed tag retains its trigger and detail.
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
