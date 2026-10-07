package linthost

import "testing"

// TestBoundariesDependenciesSelectsEntryAndPrivateTargets verifies visibility
// metadata participates in unified dependency policies.
//
// Entry and private classification reuse the legacy element-local glob logic.
// Allowed entries and a non-entry outside public/** distinguish entry and
// path predicates from the two denied private/public implementation targets.
//
// 1. Import domain entries, private/public implementations, and another non-entry.
// 2. Disallow private files and selected non-entry public paths.
// 3. Assert the entry passes while both restricted targets report.
//
// @evidence contracts/testing.md#behavioral-verification Policies deny private domain paths and nonentry public/detail while allowing the domain index entry.
// @evidence contracts/testing.md#independent-expectations The fixture entry index.ts, private internal/** and explicit public/** selector determine two authored denied substrings independently.
// @evidence contracts/testing.md#distinguishing-cases The public/index entry stays clean despite matching public/**, and other/detail stays clean despite being nonentry. Private internal/secret and nonentry public/detail report, distinguishing both entry and path predicates.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run using the entry/private/path options and authored fixture files. This entry owns all five visibility inputs and both denied targets in the Go process.
func TestBoundariesDependenciesSelectsEntryAndPrivateTargets(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain\";\nimport \"../domain/internal/secret\";\nimport \"../domain/public/detail\";\nimport \"../domain/public/index\";\nimport \"../domain/other/detail\";\n"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {
        "type":"domain",
        "pattern":"src/domain/**",
        "entry":"index.ts",
        "private":"internal/**"
      }
    ],
    "default":"allow",
    "policies": [
      {"from":"app","disallow":{"to":{"type":"domain","private":true}}},
      {"from":"app","disallow":{"to":{"type":"domain","entry":false,"path":"public/**"}}}
    ]
  }`, map[string]string{
    "src/domain/index.ts":           "export {};",
    "src/domain/internal/secret.ts": "export {};",
    "src/domain/public/detail.ts":   "export {};",
    "src/domain/public/index.ts":    "export {};",
    "src/domain/other/detail.ts":    "export {};",
  })
  assertBoundaryFindingTexts(
    t,
    source,
    findings,
    `"../domain/internal/secret"`,
    `"../domain/public/detail"`,
  )
}
