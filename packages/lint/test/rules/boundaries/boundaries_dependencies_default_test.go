package linthost

import "testing"

// TestBoundariesDependenciesDefaultsToDisallow verifies the current upstream
// fallback and its explicit allow inverse.
//
// A missing `default` is intentionally restrictive. Pinning the allow twin
// prevents the implementation from reporting every dependency unconditionally
// while also guarding against the former port's documented allow default.
//
// 1. Run the same app-to-domain dependency with no matching policies.
// 2. Compare omitted and explicit-allow default settings.
// 3. Assert the omitted default reports once and explicit allow reports none.
func TestBoundariesDependenciesDefaultsToDisallow(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain/model\";\n"
  files := map[string]string{"src/domain/model.ts": "export {};"}
  elements := `"elements":[
    {"type":"app","pattern":"src/app/**"},
    {"type":"domain","pattern":"src/domain/**"}
  ]`

  denied := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+elements+`}`, files)
  assertSingleBoundaryFinding(t, ruleName, denied, `no policy allowing`)

  allowed := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+elements+`,"default":"allow"}`, files)
  if len(allowed) != 0 {
    t.Fatalf("explicit allow default: want no findings, got %+v", allowed)
  }
}
