package linthost

import (
  "encoding/json"
  "path/filepath"
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type commandProjectInputRule struct{}

func (commandProjectInputRule) Name() string                     { return "test/command-project-inputs" }
func (commandProjectInputRule) Check(*publicrule.ProjectContext) {}
func (commandProjectInputRule) ProjectInputs(ctx *publicrule.ProjectInputContext) []publicrule.ProjectInput {
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
  }
}

// TestProjectInputsCommandPublishesConfiguredSnapshotWithoutProgram verifies
// the public sidecar verb carries the same dependency snapshot collected by the
// host internals.
//
// The command must resolve lint config, project-rule options, and physical
// identity without requiring a tsconfig or loading a TypeScript Program. This
// is what lets watch topology be known before the first check cycle.
//
//  1. Register one input-publishing rule and write only a lint config.
//  2. Invoke the dispatch front door with project-inputs.
//  3. Decode stdout and assert config, exact file, glob, and root identity.
func TestProjectInputsCommandPublishesConfiguredSnapshotWithoutProgram(t *testing.T) {
  root := t.TempDir()
  name := "test/command-project-inputs"
  previous, existed := registeredProjectRules[name]
  registeredProjectRules[name] = projectRuleAdapter{
    inner:          commandProjectInputRule{},
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
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      name: []any{"error", map[string]any{
        "file": "docs/missing.md",
        "glob": "api/**/*.yaml",
      }},
    },
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "project-inputs",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("project-inputs exit %d: %s", code, stderr)
  }
  var snapshot ProjectInputSnapshot
  if err := json.Unmarshal([]byte(stdout), &snapshot); err != nil {
    t.Fatalf("decode project-inputs stdout: %v\n%s", err, stdout)
  }
  physicalRoot := realProjectPath(root)
  wantFiles := []string{
    filepath.ToSlash(realProjectPath(filepath.Join(root, "docs", "missing.md"))),
    filepath.ToSlash(realProjectPath(filepath.Join(root, "lint.config.json"))),
  }
  if snapshot.Root != filepath.ToSlash(physicalRoot) {
    t.Fatalf("root = %q, want %q", snapshot.Root, physicalRoot)
  }
  if !reflect.DeepEqual(snapshot.Files, wantFiles) {
    t.Fatalf("files = %#v, want %#v", snapshot.Files, wantFiles)
  }
  wantGlobs := []string{
    filepath.ToSlash(realProjectGlob(filepath.Join(root, "api", "**", "*.yaml"))),
  }
  if !reflect.DeepEqual(snapshot.Globs, wantGlobs) {
    t.Fatalf("globs = %#v, want %#v", snapshot.Globs, wantGlobs)
  }
}
