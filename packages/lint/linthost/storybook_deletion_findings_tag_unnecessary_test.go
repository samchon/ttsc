package linthost

import (
  "strings"
  "testing"
)

// TestStorybookDeletionFindingsTagUnnecessary keeps the historical entry name
// while verifying title and redundant-name findings remain untagged.
//
// Independent literal ranges and mechanically sliced remaining strings pin
// first/last-property and standalone-statement boundaries. A syntax-shaped
// deletion range does not prove that the property value or assignment can be
// removed without observable effects; the effect-bearing inputs are parsed,
// not executed. Missing component metadata also remains untagged.
//
//  1. Assert title and redundant-name findings have no diagnostic tags.
//  2. Compare every reported range and mechanically sliced result with literals.
//  3. Keep value-producing, private-local and nested-shadow annotations silent.
//  4. Preserve a call-valued title and setter-bearing story-name assignment as
//     untagged findings, without certifying their runtime effects or deletion.
//
// @evidence contracts/testing.md#behavioral-verification The actual snapshot engine reports title and redundant story-name findings with empty tags and exact authored ranges; manual source slicing is compared with independent whole strings, not executed as a safe fix.
// @evidence contracts/testing.md#independent-expectations Unnecessary requires safe-to-delete source, which these predicates do not establish for title evaluation or property assignment. Authored ranges and sliced strings independently fix the diagnostic boundaries; missing component information is also untagged.
// @evidence contracts/testing.md#distinguishing-cases First/last properties and standalone assignments contrast with value-producing assignments, private locals and shadowed names. A call-valued title and setter-bearing assignment distinguish syntactic redundancy from a runtime deletion guarantee; their effects are not executed here.
// @evidence contracts/testing.md#execution-ownership TestStorybookDeletionFindingsTagUnnecessary owns these explicit variants as one Go unit entry; actual parsed-source engine operations run in the shared Go process without an installed Storybook host.
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
    {
      rule:      "storybook/no-title-property-in-meta",
      source:    "export default { title: recordTitle(), component: Button };\nexport const Primary = {};\n",
      marker:    "title: recordTitle(),",
      remaining: "export default {  component: Button };\nexport const Primary = {};\n",
    },
    {
      rule:      "storybook/no-redundant-story-name",
      source:    "export default { component: Button };\nexport const Primary = {};\nObject.defineProperty(Primary, \"storyName\", { set(value) { recordName(value); } });\nPrimary.storyName = \"Primary\";\n",
      marker:    "Primary.storyName = \"Primary\";",
      remaining: "export default { component: Button };\nexport const Primary = {};\nObject.defineProperty(Primary, \"storyName\", { set(value) { recordName(value); } });\n\n",
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
        "%s: slicing reported range\nwant %q\ngot  %q",
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
  assertRuleSkipsSource(
    t,
    "storybook/no-redundant-story-name",
    "export default { component: Button };\nconst Local = {};\nLocal.storyName = \"Local\";\nconsole.log(Local);\n",
  )
  assertRuleSkipsSource(
    t,
    "storybook/no-redundant-story-name",
    "export default { component: Button };\nexport const Primary = {};\nfunction annotate(Primary: { storyName?: string }) {\n  Primary.storyName = \"Primary\";\n}\nconsole.log(annotate);\n",
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
