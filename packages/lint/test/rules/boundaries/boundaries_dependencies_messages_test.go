package linthost

import "testing"

// TestBoundariesDependenciesRendersPolicyAndGlobalMessages verifies custom
// diagnostic precedence and stable template data.
//
// A policy-specific message must override the global fallback only for its own
// denial. The source, target, dependency kind, and policy index placeholders
// are derived from the evaluated edge rather than from fixture-specific text.
//
// 1. Deny domain with a policy message and shared with the global message.
// 2. Import one value from each target element.
// 3. Assert both fully rendered messages and their precedence.
func TestBoundariesDependenciesRendersPolicyAndGlobalMessages(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/model";
    import "../shared/value";
  `, `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"},
      {"type":"shared","pattern":"src/shared/**"}
    ],
    "default":"allow",
    "message":"global {{from.type}} -> {{to.type}}: {{dependency.source}}",
    "policies": [
      {
        "from":"app",
        "disallow":"domain",
        "message":"policy {{policy.index}} blocks {{dependency.kind}} {{from.type}} -> {{to.type}}"
      },
      {"from":"app","disallow":"shared"}
    ]
  }`, map[string]string{
    "src/domain/model.ts": "export {};",
    "src/shared/value.ts": "export {};",
  })
  if len(findings) != 2 {
    t.Fatalf("want two findings, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  if !messages["policy 0 blocks value app -> domain"] {
    t.Fatalf("missing policy message: %+v", findings)
  }
  if !messages["global app -> shared: ../shared/value"] {
    t.Fatalf("missing global message: %+v", findings)
  }
}
