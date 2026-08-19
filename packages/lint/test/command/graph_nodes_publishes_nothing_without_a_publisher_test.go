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
// would read as the second. The verb also must not build a Program to reach
// that answer, which is what keeps such a project paying nothing for it.
//
//  1. Seed a valid TypeScript project with an unrelated rule enabled.
//  2. Run graph-nodes through the command dispatcher and decode its JSON.
//  3. Assert exit 0, a clean stderr, and an empty array rather than a null.
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
