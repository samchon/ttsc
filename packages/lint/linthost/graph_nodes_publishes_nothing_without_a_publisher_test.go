package linthost

import (
  "encoding/json"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestGraphNodesPublishesNothingWithoutAPublisher verifies the artifact verb
// answers an empty set — successfully — for a project no rule publishes for.
//
// The empty answer is the contract, not an edge case. A project that does not
// use the citation convention is the common case, and a consumer must be able
// to tell "nothing to index" from "the project is broken"; a nonzero exit here
// would read as the second. This entry observes the response after real
// config resolution; it does not measure Program allocation or zero cost.
//
//  1. Seed a valid TypeScript project with an unrelated rule enabled.
//  2. Run graph-nodes through the command dispatcher and decode its JSON.
//  3. Assert exit 0, a clean stderr, and an empty array rather than a null.
//
// @evidence contracts/testing.md#behavioral-verification Actual graph-nodes command dispatch for a valid project with an unrelated jsdoc rule returns success, no stderr and a decoded nonnil empty GraphNode array rather than null or fabricated artifacts.
// @evidence contracts/testing.md#independent-expectations Without a configured graph publisher the public response is an empty JSON array and status zero; a literal unrelated syntax rule does not imply artifacts. Decoding distinguishes the published empty-array contract from null independently of serialization spelling.
// @evidence contracts/testing.md#distinguishing-cases The project and lint configuration are valid, so success cannot be explained by accepting invalid configuration; nonnil emptiness rejects both null and invented nodes. This entry verifies the observable response, not whether a Program allocation occurred internally.
// @evidence contracts/testing.md#execution-ownership The command front door, real config loader and JSON serialization execute in-process over an authored temporary project; captureCommandOutput inspects actual streams and status. No installed consumer, native artifact producer or child process is used.
func TestGraphNodesPublishesNothingWithoutAPublisher(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "graph-nodes",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stderr != "" {
    t.Fatalf("graph-nodes mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var nodes []publicrule.GraphNode
  if err := json.Unmarshal([]byte(stdout), &nodes); err != nil {
    t.Fatalf("graph-nodes JSON: %v\n%s", err, stdout)
  }
  if nodes == nil {
    t.Fatalf("graph-nodes emitted a JSON null; a consumer decoding an array reads that as a broken plugin")
  }
  if len(nodes) != 0 {
    t.Fatalf("want no artifacts for a project with no publisher, got %d", len(nodes))
  }
}
