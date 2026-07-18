package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestStorybookLegacyApiFindingsTagDeprecated verifies the two storybook rules
// that report a superseded-but-working construct tag their findings
// Deprecated, and that a wrong-package import does not.
//
// Deprecated strikes the range through and means "this still works, migrate
// off it" — which is exactly what `storiesOf` and the `|` title separator are:
// Storybook keeps honouring both. `storybook/no-renderer-packages` is the
// negative twin because it also reports an import, but a renderer package is
// not a deprecated API; it is the wrong layer to import from, and striking it
// through would misstate why it is reported.
//
//  1. Report a `storiesOf` import specifier and a piped meta title, asserting
//     each finding carries one Deprecated tag.
//  2. Assert each range covers the deprecated construct itself.
//  3. Assert the negative twin `storybook/no-renderer-packages` reports
//     untagged.
func TestStorybookLegacyApiFindingsTagDeprecated(t *testing.T) {
  cases := []struct {
    rule   string
    source string
    marker string
  }{
    {
      rule:   "storybook/no-stories-of",
      source: "import { storiesOf } from \"@storybook/react\";\nstoriesOf(\"Atoms/Button\", module);\n",
      marker: "storiesOf",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms|Button\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "title: \"Atoms|Button\"",
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
    // `storiesOf` also appears in the call below the import; the first
    // occurrence is the import specifier the rule reports.
    start := strings.Index(testCase.source, testCase.marker)
    if start < 0 {
      t.Fatalf("%s: marker %q missing from source", testCase.rule, testCase.marker)
    }
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

  renderer := "import type { Meta } from \"@storybook/react\";\nexport default { component: Button };\n"
  _, _, findings := runRuleFindingsSnapshot(t, "storybook/no-renderer-packages", renderer, nil)
  if len(findings) != 1 {
    t.Fatalf("no-renderer-packages findings = %d, want 1 (%+v)", len(findings), findings)
  }
  if len(findings[0].Tags) != 0 {
    t.Fatalf("no-renderer-packages tags = %v, want none", findings[0].Tags)
  }
}
