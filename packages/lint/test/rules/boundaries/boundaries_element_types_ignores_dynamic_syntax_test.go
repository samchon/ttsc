package linthost

import "testing"

// TestBoundariesElementTypesIgnoresDynamicSyntax verifies the legacy split
// rules keep their static import/export dependency surface.
//
// The unified `boundaries/dependencies` collector also gathers `import()`,
// `require()`, `import =`, and import-type nodes. Legacy rules ship a narrower
// shipped contract, so sharing the extended collector would silently widen
// `element-types` (and its siblings) in the same release that implements the
// unified rule.
//
// 1. Load a disallowed domain target through dynamic import and require only.
// 2. Run the legacy `element-types` policy that rejects static domain imports.
// 3. Assert the legacy rule stays silent while `dependencies` reports both.
func TestBoundariesElementTypesIgnoresDynamicSyntax(t *testing.T) {
  source := "void import(\"../domain/dynamic\");\nconst required = require(\"../domain/required\");\nvoid required;\n"
  files := map[string]string{
    "src/domain/dynamic.ts":  "export {};",
    "src/domain/required.ts": "export {};",
  }
  options := `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"}
    ],
    "default":"allow",
    "rules":[{"from":"app","disallow":"domain"}]
  }`

  legacy := runBoundaryRule(t, "boundaries/element-types", "src/app/main.ts", source, options, files)
  if len(legacy) != 0 {
    t.Fatalf("element-types must ignore dynamic dependency syntax, got %+v", legacy)
  }

  unified := runBoundaryRule(t, "boundaries/dependencies", "src/app/main.ts", source, options, files)
  assertBoundaryFindingTexts(t, source, unified, `"../domain/dynamic"`, `"../domain/required"`)
}
