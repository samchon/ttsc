package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleCorpusStorybookNoUninstalledAddons verifies an authored manifest fixture for storybook/no-uninstalled-addons.
//
// Addon config validation depends on resolving the nearest package.json, which the generic virtual corpus helper
// cannot model. This test materializes a tiny Storybook config tree and keeps the rule's filesystem branch covered.
//
// 1. Write package.json with one declared Storybook addon dependency.
// 2. Parse .storybook/main.ts containing one declared addon and one absent addon.
// 3. Assert only storybook/no-uninstalled-addons reports the missing addon literal.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run resolves the nearest fixture package manifest and reports only missing addon-essentials, keeping manifest-declared addon-links clean.
// @evidence contracts/testing.md#independent-expectations The authored devDependencies contains addon-links only; addon-essentials is independently absent, which determines the exact annotated rule/severity/line.
// @evidence contracts/testing.md#distinguishing-cases Manifest-declared and absent addon declarations share one config source; isolated fixture lookup interprets dependencies instead of checking committed repository text.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookNoUninstalledAddons owns these explicit variants as one Go unit entry; actual engine and fixture lookup run in the shared Go process without an installed Storybook host.
func TestRuleCorpusStorybookNoUninstalledAddons(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "package.json"), `{"devDependencies":{"@storybook/addon-links":"latest"}}`)
  source := "export default {\n  addons: [\n    \"@storybook/addon-links\",\n    // expect: storybook/no-uninstalled-addons error\n    \"@storybook/addon-essentials\",\n  ],\n};\n"
  file := parseTSFile(t, filepath.Join(dir, ".storybook", "main.ts"), source)
  expected := parseRuleExpectations(t, source)
  findings := NewEngine(RuleConfig{"storybook/no-uninstalled-addons": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"storybook/no-uninstalled-addons": SeverityError}, findings); err != nil {
    t.Fatalf("invalid addon findings: %v", err)
  }
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
  // The real sibling package lookup crosses OS path semantics; recording only
  // after the exact finding comparison keeps the platform harness trustworthy.
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessPlatform)
}
