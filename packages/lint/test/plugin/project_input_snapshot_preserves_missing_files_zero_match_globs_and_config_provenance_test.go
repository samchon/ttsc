package linthost

import (
  "encoding/json"
  "path/filepath"
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type projectInputSnapshotRule struct{}

func (projectInputSnapshotRule) Name() string                     { return "test/project-inputs" }
func (projectInputSnapshotRule) Check(*publicrule.ProjectContext) {}
func (projectInputSnapshotRule) ProjectInputs(ctx *publicrule.ProjectInputContext) []publicrule.ProjectInput {
  var options struct {
    File string `json:"file"`
    Glob string `json:"glob"`
  }
  if err := ctx.DecodeOptions(&options); err != nil {
    panic(err)
  }
  return []publicrule.ProjectInput{
    {Kind: publicrule.ProjectInputFile, Pattern: options.File},
    {Kind: publicrule.ProjectInputGlob, Pattern: options.Glob},
    {Kind: publicrule.ProjectInputFile, Pattern: options.File},
  }
}

// TestProjectInputSnapshotPreservesMissingFilesZeroMatchGlobsAndConfigProvenance
// verifies dependency publication describes configured topology rather than the
// files one successful rule cycle happened to read.
//
// Missing exact paths and zero-match globs must survive unchanged so a later
// create or rename can wake the host. The lint config is another exact
// dependency, and duplicate declarations from multiple rules share one owner.
//
//  1. Enable one project rule with a missing Markdown path and empty JSON glob.
//  2. Collect the snapshot before either dependency exists.
//  3. Assert both declarations and the lint config remain, each exactly once.
func TestProjectInputSnapshotPreservesMissingFilesZeroMatchGlobsAndConfigProvenance(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "lint.config.json")
  options := json.RawMessage(`{"file":"docs/missing.md","glob":"api/**/*.json"}`)
  name := "test/project-inputs"
  previous, existed := registeredProjectRules[name]
  registeredProjectRules[name] = projectRuleAdapter{
    inner:          projectInputSnapshotRule{},
    name:           name,
    acceptsOptions: true,
  }
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[name] = previous
    } else {
      delete(registeredProjectRules, name)
    }
  })
  resolver := &ConfigStore{
    paths: []string{config},
    entries: []ConfigEntry{{
      BaseDir: root,
      Rules:   RuleConfig{name: SeverityError},
      Options: RuleOptionsMap{name: options},
    }},
  }
  bound, err := bindProjectRuleResolver(resolver)
  if err != nil {
    t.Fatalf("bind project rules: %v", err)
  }
  snapshot, err := collectProjectInputs(bound, publicrule.ProjectIdentity{
    InvocationCwd:       root,
    LogicalProjectRoot:  root,
    PhysicalProjectRoot: root,
  })
  if err != nil {
    t.Fatalf("collect project inputs: %v", err)
  }
  wantFiles := []string{
    filepath.ToSlash(filepath.Join(root, "docs", "missing.md")),
    filepath.ToSlash(config),
  }
  if !reflect.DeepEqual(snapshot.Files, wantFiles) {
    t.Fatalf("files = %#v, want %#v", snapshot.Files, wantFiles)
  }
  wantGlobs := []string{filepath.ToSlash(filepath.Join(root, "api", "**", "*.json"))}
  if !reflect.DeepEqual(snapshot.Globs, wantGlobs) {
    t.Fatalf("globs = %#v, want %#v", snapshot.Globs, wantGlobs)
  }
}
