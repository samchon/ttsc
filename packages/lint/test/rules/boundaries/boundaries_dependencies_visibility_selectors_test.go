package linthost

import "testing"

// TestBoundariesDependenciesSelectsEntryAndPrivateTargets verifies visibility
// metadata participates in unified dependency policies.
//
// Entry and private classification reuse the legacy element-local glob logic.
// Pairing an allowed entry with private and non-entry targets guards against
// treating every file in an element as having the same visibility.
//
// 1. Import a domain entry, private implementation, and non-entry public file.
// 2. Disallow private files and selected non-entry public paths.
// 3. Assert the entry passes while both restricted targets report.
//
// @evidence contracts/testing.md#behavioral-verification Policies deny private domain paths and nonentry public/detail while allowing the domain index entry.
// @evidence contracts/testing.md#independent-expectations The fixture entry index.ts, private internal/** and explicit public/** selector determine two authored denied substrings independently.
// @evidence contracts/testing.md#distinguishing-cases Entry, private and public-nonentry imports from one source distinguish visibility and entry/path predicates.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run using the entry/private/path options and authored fixture files. This entry owns all three visibility inputs and both denied targets in the Go process.
func TestBoundariesDependenciesSelectsEntryAndPrivateTargets(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain\";\nimport \"../domain/internal/secret\";\nimport \"../domain/public/detail\";\n"
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
  })
  assertBoundaryFindingTexts(
    t,
    source,
    findings,
    `"../domain/internal/secret"`,
    `"../domain/public/detail"`,
  )
}
