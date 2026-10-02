package linthost

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPServeAnswersHintsFromTheResidentDaemon verifies one hints request
// receives the configured corpus through the resident stream dispatcher.
//
// A valid request must return a successful framed response with the typed param
// completion. This case exercises the resident loop in process; one request
// does not establish warm Program reuse or a spawned sidecar connection.
//
//  1. Seed a project with the JSDoc validator enabled.
//  2. Drive lsp-serve with one lsp-hints request line.
//  3. Assert code 0, corpus size correspondence and literal param metadata.
//
// @evidence contracts/testing.md#behavioral-verification The in-process lsp-serve stream handles one hints request and returns code 0 with corpus size correspondence and the complete literal param completion.
// @evidence contracts/testing.md#independent-expectations The authored request line and literal reply code zero express the resident protocol contract. Literal param insertion, empty label, typed detail, jsdoc scope and @ trigger independently require the representative payload. Size equality with knownJSDocTags is only adapter correspondence and cannot prove every vocabulary entry.
// @evidence contracts/testing.md#distinguishing-cases A daemon that rejects or omits the lsp-hints verb would reply with a nonzero code or an empty, malformed or incorrect representative payload, which this single request detects. Other verbs and multiple requests per stream are not covered.
// @evidence contracts/testing.md#execution-ownership Drives RunLSPServe in process with a one-line stdin reader and a buffer writer and decodes the reply; the daemon loop runs inside the test process rather than as a spawned binary.
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
  expected := publicrule.Hint{
    Insert:  "param",
    Detail:  "accepts a type",
    Trigger: publicrule.HintTrigger{Scope: publicrule.HintScopeJSDoc, After: "@"},
  }
  found := false
  for _, hint := range hints {
    if hint.Insert == "param" {
      found = true
      if hint != expected {
        t.Fatalf("param completion: want %#v, got %#v", expected, hint)
      }
    }
  }
  if !found {
    t.Fatal("resident hints response omitted param")
  }
}
