package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleSourcesApplyOnlyGlobalIgnores verifies ignores filter source
// inputs without acting as project-rule selectors.
//
// A global ignore removes its matching source from ProjectContext.Sources. An
// ignore paired with files only refines that file-scoped entry and therefore
// cannot remove a source from the Program-wide project-rule input.
//
//  1. Configure one global ignore and one file-scoped ignore.
//  2. Run an enabled project rule over ignored, scoped, and ordinary sources.
//  3. Assert only the globally ignored source is absent and the rule still ran.
func TestProjectRuleSourcesApplyOnlyGlobalIgnores(t *testing.T) {
  const name = "project-test/source-ignores"
  root := t.TempDir()
  generated := filepath.Join(root, "generated", "a.ts")
  scoped := filepath.Join(root, "scoped", "b.ts")
  ordinary := filepath.Join(root, "src", "c.ts")
  observed := []string{}
  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: name,
    check: func(ctx *publicrule.ProjectContext) {
      for _, source := range ctx.Sources {
        observed = append(observed, source.FileName())
      }
    },
  })
  store := &ConfigStore{entries: []ConfigEntry{
    {BaseDir: root, Ignores: []string{"generated/**"}, IgnoreOnly: true},
    {
      BaseDir:          root,
      Files:            []string{"scoped/**"},
      HasFilesSelector: true,
      Ignores:          []string{"scoped/**"},
      Rules:            RuleConfig{"some-file-rule": SeverityError},
    },
    {BaseDir: root, Rules: RuleConfig{name: SeverityError}},
  }}

  NewEngineWithResolver(store).Run([]*shimast.SourceFile{
    parseTSFile(t, generated, "export {};\n"),
    parseTSFile(t, scoped, "export {};\n"),
    parseTSFile(t, ordinary, "export {};\n"),
  }, nil)

  if len(observed) != 2 || observed[0] != scoped || observed[1] != ordinary {
    t.Fatalf("project sources should apply only global ignores, got %#v", observed)
  }
}
