package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleCorpusStorybookNoUninstalledAddons verifies the lint rule corpus fixture storybook/no-uninstalled-addons.
//
// Addon config validation depends on resolving the nearest package.json, which the generic virtual corpus helper
// cannot model. This test materializes a tiny Storybook config tree and keeps the rule's filesystem branch covered.
//
// 1. Write package.json with one installed Storybook addon.
// 2. Parse .storybook/main.ts containing one installed addon and one missing addon.
// 3. Assert only storybook/no-uninstalled-addons reports the missing addon literal.
func TestRuleCorpusStorybookNoUninstalledAddons(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "package.json"), `{"devDependencies":{"@storybook/addon-links":"latest"}}`)
  source := "export default {\n  addons: [\n    \"@storybook/addon-links\",\n    // expect: storybook/no-uninstalled-addons error\n    \"@storybook/addon-essentials\",\n  ],\n};\n"
  file := parseTSFile(t, filepath.Join(dir, ".storybook", "main.ts"), source)
  expected := parseRuleExpectations(t, source)
  findings := NewEngine(RuleConfig{"storybook/no-uninstalled-addons": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
