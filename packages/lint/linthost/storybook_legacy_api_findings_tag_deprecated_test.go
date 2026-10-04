package linthost

import (
  "strings"
  "testing"
)

// TestStorybookLegacyApiFindingsTagDeprecated keeps the historical entry name
// while checking obsolete storiesOf and pipe-title findings remain untagged.
//
// The public Deprecated tag requires still-working code. These rules do not
// select an installed Storybook version, and storiesOf was removed in 8.0
// while custom hierarchy separators were removed in 6.0. Parsed source alone
// cannot certify that either legacy operation still works. Renderer-package
// findings remain untagged for their separate integration-layer policy.
//
//  1. Check ordinary/aliased storiesOf and literal/four escaped pipe titles.
//  2. Pin each exact range to the obsolete import name or pipe spelling.
//  3. Require empty tags for these and renderer-package findings, and no
//     finding for a same-named import from an application module.
//
// @evidence contracts/testing.md#behavioral-verification Actual snapshots verify empty tags and exact ranges for the storiesOf import names and five raw pipe spellings; renderer-package findings stay untagged and the application import stays clean.
// @evidence contracts/testing.md#independent-expectations Deprecated requires a still-working construct, which these version-independent predicates cannot establish after Storybook removed these legacy operations. Independent literal markers locate the obsolete spellings without certifying installed-runtime support.
// @evidence contracts/testing.md#distinguishing-cases Ordinary/aliased imports and literal/four escaped pipe spellings pin distinct raw ranges; a same-named application import stays clean, and renderer-package misuse has its own untagged finding.
// @evidence contracts/testing.md#execution-ownership TestStorybookLegacyApiFindingsTagDeprecated owns these explicit variants as one Go unit entry; actual parsed-source engine operations run in the shared Go process without an installed Storybook host.
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
      rule:   "storybook/no-stories-of",
      source: "import { storiesOf as legacyStories } from \"@storybook/react\";\nlegacyStories(\"Atoms/Button\", module);\n",
      marker: "storiesOf",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms|Button\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "|",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms\\u007CButton\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "\\u007C",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms\\x7CButton\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "\\x7C",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms\\u{7C}Button\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "\\u{7C}",
    },
    {
      rule:   "storybook/hierarchy-separator",
      source: "export default {\n  title: \"Atoms\\|Button\",\n  component: Button,\n};\nexport const Primary = {};\n",
      marker: "\\|",
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
    // `storiesOf` can also appear in the call below the import; the first
    // occurrence is the imported API the rule reports.
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

  assertRuleSkipsSource(
    t,
    "storybook/no-stories-of",
    "import { storiesOf } from \"./story-dsl\";\nstoriesOf(\"Atoms/Button\", module);\n",
  )
}
