package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestStorybookDeletionFindingsTagUnnecessary verifies the two storybook rules
// whose whole resolution is a deletion tag their findings Unnecessary, and
// that a rule reporting missing metadata does not.
//
// Unnecessary tells the editor to fade the range, which reads as "remove
// this". `storybook/csf-component` is the counter-case that makes the
// distinction concrete: it reports a meta object that is missing a
// `component` property, so the work is unfinished rather than dead, and
// greying it would tell the author to delete the meta they still have to
// complete.
//
//  1. Report a CSF3 `title` in meta and both arms of the redundant-story-name
//     rule, asserting each finding carries one Unnecessary tag.
//  2. Delete each tagged range and assert the source left behind is valid
//     object/statement syntax, including first- and last-property boundaries.
//  3. Keep an assignment nested in another expression silent because its value
//     is live and a rule-wide Unnecessary tag would be false.
//  4. Assert the negative twin `storybook/csf-component` reports untagged.
func TestStorybookDeletionFindingsTagUnnecessary(t *testing.T) {
  cases := []struct {
    rule      string
    source    string
    marker    string
    remaining string
  }{
    {
      rule:      "storybook/no-title-property-in-meta",
      source:    "export default {\n  title: \"Atoms/Button\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker:    "title: \"Atoms/Button\",",
      remaining: "export default {\n  \n  component: Button,\n};\nexport const Primary = {};\n",
    },
    {
      rule:      "storybook/no-redundant-story-name",
      source:    "export default { component: Button };\nexport const Primary = {\n  name: \"Primary\",\n};\n",
      marker:    "name: \"Primary\",",
      remaining: "export default { component: Button };\nexport const Primary = {\n  \n};\n",
    },
    {
      rule:      "storybook/no-redundant-story-name",
      source:    "export default { component: Button };\nexport const Primary = {};\nPrimary.storyName = \"Primary\";\n",
      marker:    "Primary.storyName = \"Primary\";",
      remaining: "export default { component: Button };\nexport const Primary = {};\n\n",
    },
    {
      rule:      "storybook/no-title-property-in-meta",
      source:    "export default {\n  component: Button,\n  title: \"Atoms/Button\"\n};\nexport const Primary = {};\n",
      marker:    "title: \"Atoms/Button\"",
      remaining: "export default {\n  component: Button,\n  \n};\nexport const Primary = {};\n",
    },
  }
  for _, testCase := range cases {
    _, _, findings := runRuleFindingsSnapshot(t, testCase.rule, testCase.source, nil)
    if len(findings) != 1 {
      t.Fatalf("%s: findings = %d, want 1 (%+v)", testCase.rule, len(findings), findings)
    }
    finding := findings[0]
    if len(finding.Tags) != 1 || finding.Tags[0] != publicrule.DiagnosticTagUnnecessary {
      t.Fatalf("%s: tags = %v, want [Unnecessary]", testCase.rule, finding.Tags)
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
    remaining := testCase.source[:finding.Pos] + testCase.source[finding.End:]
    if remaining != testCase.remaining {
      t.Fatalf(
        "%s: deleting tagged range\nwant %q\ngot  %q",
        testCase.rule,
        testCase.remaining,
        remaining,
      )
    }
  }

  assertRuleSkipsSource(
    t,
    "storybook/no-redundant-story-name",
    "export default { component: Button };\nexport const Primary = {};\nconst derived = Primary.storyName = \"Primary\";\nconsole.log(derived);\n",
  )

  incomplete := "export default {\n  title: \"Atoms/Button\",\n};\nexport const Primary = {};\n"
  _, _, findings := runRuleFindingsSnapshot(t, "storybook/csf-component", incomplete, nil)
  if len(findings) != 1 {
    t.Fatalf("csf-component findings = %d, want 1 (%+v)", len(findings), findings)
  }
  if len(findings[0].Tags) != 0 {
    t.Fatalf("csf-component tags = %v, want none", findings[0].Tags)
  }
}
