package linthost

import "testing"

// TestBoundariesDependenciesUsesLastPolicyAndDisallowPrecedence verifies the
// upstream policy ordering contract in both dimensions.
//
// A later allow must override an earlier disallow, while `disallow` must win
// over `allow` when both effects in the same policy match. Reversing either
// precedence silently changes architecture policy during migration.
//
// 1. Import one domain and one shared element from an app file.
// 2. Override domain to allowed, but match both effects for shared.
// 3. Assert only the shared import is rejected.
func TestBoundariesDependenciesUsesLastPolicyAndDisallowPrecedence(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain/model\";\nimport \"../shared/value\";\n"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" },
      { "type": "shared", "pattern": "src/shared/**" }
    ],
    "default": "allow",
    "policies": [
      { "from": "app", "disallow": "domain" },
      { "from": "app", "allow": "domain" },
      { "from": "app", "allow": "shared", "disallow": "shared" }
    ]
  }`, map[string]string{
    "src/domain/model.ts": "export {};",
    "src/shared/value.ts": "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `policy at index 2`)
  assertBoundaryFindingTexts(t, source, findings, `"../shared/value"`)
}
