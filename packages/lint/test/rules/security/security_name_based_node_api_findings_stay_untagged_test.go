package linthost

import (
  "strings"
  "testing"
)

// TestSecurityNameBasedNodeApiFindingsStayUntagged verifies the security rules
// whose syntactic matches admit user-defined objects do not stamp every
// finding with a Node deprecation tag.
//
// `detect-new-buffer` and `detect-pseudoRandomBytes` intentionally mirror
// upstream name-based detection. A local constructor named `Buffer` or object
// named `crypto` is therefore still reported, but it is not necessarily Node's
// DEP0005 / DEP0115 API. The rule-level tag grain cannot distinguish those
// findings, so leaving the rules untagged is the sound classification.
//
//  1. Report user-defined `Buffer` and `crypto` shapes and assert no tags.
//  2. Assert each range remains the exact construct the diagnostic names.
//  3. Keep `detect-buffer-noassert` untagged over its existing whole-call range.
func TestSecurityNameBasedNodeApiFindingsStayUntagged(t *testing.T) {
  cases := []struct {
    rule   string
    source string
    marker string
  }{
    {
      rule:   "security/detect-new-buffer",
      source: "class Buffer { constructor(value: unknown) {} }\nconst buffer = new Buffer(input);\nconsole.log(buffer);\n",
      marker: "new Buffer(input)",
    },
    {
      rule:   "security/detect-pseudoRandomBytes",
      source: "const crypto = { pseudoRandomBytes: (size: number) => size };\nconst bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
      marker: "crypto.pseudoRandomBytes",
    },
  }
  for _, testCase := range cases {
    _, _, findings := runRuleFindingsSnapshot(t, testCase.rule, testCase.source, nil)
    if len(findings) != 1 {
      t.Fatalf("%s: findings = %d, want 1 (%+v)", testCase.rule, len(findings), findings)
    }
    finding := findings[0]
    if len(finding.Tags) != 0 {
      t.Fatalf("%s: tags = %v, want none", testCase.rule, finding.Tags)
    }
    start := strings.LastIndex(testCase.source, testCase.marker)
    if finding.Pos != start || finding.End != start+len(testCase.marker) {
      t.Fatalf(
        "%s: range = [%d,%d), want [%d,%d) covering %q",
        testCase.rule,
        finding.Pos,
        finding.End,
        start,
        start+len(testCase.marker),
        testCase.marker,
      )
    }
  }

  noassert := "const value = buffer.readUInt8(0, true);\nconsole.log(value);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "security/detect-buffer-noassert", noassert, nil)
  if len(findings) != 1 {
    t.Fatalf("detect-buffer-noassert findings = %d, want 1 (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Tags) != 0 {
    t.Fatalf("detect-buffer-noassert tags = %v, want none", finding.Tags)
  }
  call := "buffer.readUInt8(0, true)"
  start := strings.Index(noassert, call)
  if finding.Pos != start || finding.End != start+len(call) {
    t.Fatalf(
      "detect-buffer-noassert range = [%d,%d), want [%d,%d) covering the whole call %q",
      finding.Pos,
      finding.End,
      start,
      start+len(call),
      call,
    )
  }
}
