package linthost

import "testing"

// TestBoundariesDependenciesRejectsDisallowedDirection verifies the unified
// rule enforces a configured source-to-target dependency policy.
//
// This replaces the former zero-diagnostic stub witness with an observable
// direction check. The adjacent same-element import is the negative twin: it
// remains outside evaluation unless `checkInternals` is enabled.
//
// 1. Materialize app, domain, and app-local source files.
// 2. Disallow app-to-domain dependencies with an allow fallback.
// 3. Assert only the domain module literal is reported at its exact range.
func TestBoundariesDependenciesRejectsDisallowedDirection(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain/internal\";\nimport \"./local\";\n"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" }
    ],
    "default": "allow",
    "rules": [
      { "from": "app", "disallow": "domain" }
    ]
  }`, map[string]string{
    "src/app/local.ts":       "export {};",
    "src/domain/internal.ts": "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `domain`)
  assertBoundaryFindingTexts(t, source, findings, `"../domain/internal"`)
}
