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
