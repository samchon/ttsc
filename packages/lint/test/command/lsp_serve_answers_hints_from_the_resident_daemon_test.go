package linthost

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPServeAnswersHintsFromTheResidentDaemon verifies the corpus verb is
// served by the warm daemon rather than only by a fresh process.
//
// lsp-hints was the one Program-loading verb the daemon did not answer, so
// ttscserver respawned the sidecar and rebuilt the whole Program on every save
// to publish a corpus. A daemon that rejects the verb replies with a nonzero
// code and no result, which is what this pins against.
//
//  1. Seed a project with the JSDoc validator enabled.
//  2. Drive lsp-serve with one lsp-hints request line.
//  3. Assert the reply carries code 0 and the built-in tag corpus.
func TestLSPServeAnswersHintsFromTheResidentDaemon(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})
  registerContributorsOnce()

  var out bytes.Buffer
  code := RunLSPServe(
    strings.NewReader("{\"verb\":\"lsp-hints\"}\n"),
    &out,
    []string{"--cwd", root, "--plugins-json", lintManifest(t)},
  )
  if code != 0 {
    t.Fatalf("lsp-serve exit: want 0, got %d", code)
  }

  var reply serveLSPResponse
  if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &reply); err != nil {
    t.Fatalf("lsp-serve reply JSON: %v\n%s", err, out.String())
  }
  if reply.Code != 0 {
    t.Fatalf("the daemon refused lsp-hints: code %d", reply.Code)
  }
  var hints []publicrule.Hint
  if err := json.Unmarshal(reply.Result, &hints); err != nil {
    t.Fatalf("corpus JSON: %v\n%s", err, reply.Result)
  }
  if len(hints) != len(knownJSDocTags) {
    t.Fatalf("want %d known-tag hints, got %d", len(knownJSDocTags), len(hints))
  }
}
