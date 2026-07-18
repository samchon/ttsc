package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestSecurityDeprecatedNodeApiFindingsTagDeprecated verifies the two security
// rules that report a Node-deprecated API tag their findings Deprecated, and
// that `security/detect-buffer-noassert` does not.
//
// `new Buffer` (DEP0005) and `crypto.pseudoRandomBytes` (DEP0115) both still
// resolve and still work, and each rule reports exactly the deprecated
// construct, so a strikethrough states the finding accurately.
// `detect-buffer-noassert` is the audit candidate this pins as rejected: the
// dead text is the `noAssert` argument, but the rule reports the entire call
// expression, so tagging it would fade a live buffer read. The range assertion
// below is what makes that rejection checkable rather than a claim.
//
//  1. Report `new Buffer(input)` and `crypto.pseudoRandomBytes`, asserting one
//     Deprecated tag each over exactly the deprecated construct.
//  2. Report a `noAssert` buffer read and assert it carries no tags.
//  3. Assert that finding's range spans the whole call, which is the reason
//     the tag is withheld.
func TestSecurityDeprecatedNodeApiFindingsTagDeprecated(t *testing.T) {
  cases := []struct {
    rule   string
    source string
    marker string
  }{
    {
      rule:   "security/detect-new-buffer",
      source: "const buffer = new Buffer(input);\nconsole.log(buffer);\n",
      marker: "new Buffer(input)",
    },
    {
      rule:   "security/detect-pseudoRandomBytes",
      source: "const bytes = crypto.pseudoRandomBytes(16);\nconsole.log(bytes);\n",
      marker: "crypto.pseudoRandomBytes",
    },
  }
  for _, testCase := range cases {
    _, _, findings := runRuleFindingsSnapshot(t, testCase.rule, testCase.source, nil)
    if len(findings) != 1 {
      t.Fatalf("%s: findings = %d, want 1 (%+v)", testCase.rule, len(findings), findings)
    }
    finding := findings[0]
    if len(finding.Tags) != 1 || finding.Tags[0] != publicrule.DiagnosticTagDeprecated {
      t.Fatalf("%s: tags = %v, want [Deprecated]", testCase.rule, finding.Tags)
    }
    start := strings.Index(testCase.source, testCase.marker)
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
