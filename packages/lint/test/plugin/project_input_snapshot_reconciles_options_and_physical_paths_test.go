package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectInputSnapshotReconcilesOptionsAndPhysicalPaths verifies each
// publication is a replacement snapshot rooted in physical filesystem
// identity.
//
// A host must be able to discard old option-derived dependencies after a
// config change, and two lexical spellings of a linked project must not create
// separate watcher ownership. This test uses a directory symlink where the
// platform permits one and otherwise keeps the option-reconciliation half.
//
//  1. Publish an initial exact path and glob from enabled rule options.
//  2. Publish a replacement config with different patterns.
//  3. Assert no old pattern leaks and the snapshot uses the real project root.
//
// @evidence contracts/testing.md#behavioral-verification Actual successive project input publications replace old Markdown/JSON patterns with new Markdown/YAML patterns and share the physical root; where permitted the selected root is a real directory symlink.
// @evidence contracts/testing.md#independent-expectations Authored old/new relative patterns and standard-library EvalSymlinks of the physical temporary directory independently specify exact first and replacement lists, supplementing original product-normalizer expectations.
// @evidence contracts/testing.md#distinguishing-cases Different files/glob extensions distinguish replacing from accumulating old dependencies; symlink identity is exercised when native permission allows creation, while original option reconciliation always remains exercised.
// @evidence contracts/testing.md#execution-ownership Real resolver binding, public publisher and native temporary filesystem identity execute in-process with cleanup. Optional symlink permission behavior is preserved explicitly; no watcher, native plugin producer or installed consumer is claimed.
func TestProjectInputSnapshotReconcilesOptionsAndPhysicalPaths(t *testing.T) {
  physicalRoot := t.TempDir()
  selectedRoot := physicalRoot
  link := filepath.Join(t.TempDir(), "linked-project")
  if err := os.Symlink(physicalRoot, link); err == nil {
    selectedRoot = link
  }

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

  collect := func(file, glob string) ProjectInputSnapshot {
    t.Helper()
    resolver, err := bindProjectRuleResolver(&ConfigStore{
      entries: []ConfigEntry{{
        BaseDir: physicalRoot,
        Rules:   RuleConfig{name: SeverityError},
        Options: RuleOptionsMap{name: json.RawMessage(
          `{"file":` + quotedJSON(file) + `,"glob":` + quotedJSON(glob) + `}`,
        )},
      }},
    })
    if err != nil {
      t.Fatalf("bind project rules: %v", err)
    }
    snapshot, err := collectProjectInputs(
      resolver,
      publicrule.ProjectIdentity{PhysicalProjectRoot: selectedRoot},
    )
    if err != nil {
      t.Fatalf("collect project inputs: %v", err)
    }
    return snapshot
  }

  first := collect("docs/old.md", "api/old/**/*.json")
  second := collect("docs/new.md", "api/new/**/*.yaml")
  canonicalRoot := realProjectPath(physicalRoot)
  if first.Root != filepath.ToSlash(canonicalRoot) ||
    second.Root != first.Root {
    t.Fatalf("physical roots = %q then %q, want %q", first.Root, second.Root, canonicalRoot)
  }
  wantFiles := []string{
    filepath.ToSlash(realProjectPath(filepath.Join(physicalRoot, "docs", "new.md"))),
  }
  wantGlobs := []string{
    filepath.ToSlash(realProjectGlob(filepath.Join(physicalRoot, "api", "new", "**", "*.yaml"))),
  }
  if !reflect.DeepEqual(second.Files, wantFiles) {
    t.Fatalf("replacement files = %#v, want %#v", second.Files, wantFiles)
  }
  if !reflect.DeepEqual(second.Globs, wantGlobs) {
    t.Fatalf("replacement globs = %#v, want %#v", second.Globs, wantGlobs)
  }
  physical, err := filepath.EvalSymlinks(physicalRoot)
  if err != nil { t.Fatal(err) }
  if first.Root != filepath.ToSlash(physical) || !reflect.DeepEqual(first.Files, []string{filepath.ToSlash(filepath.Join(physical, "docs", "old.md"))}) || !reflect.DeepEqual(first.Globs, []string{filepath.ToSlash(filepath.Join(physical, "api", "old", "**", "*.json"))}) || !reflect.DeepEqual(second.Files, []string{filepath.ToSlash(filepath.Join(physical, "docs", "new.md"))}) || !reflect.DeepEqual(second.Globs, []string{filepath.ToSlash(filepath.Join(physical, "api", "new", "**", "*.yaml"))}) { t.Fatalf("authored physical dependency patterns were not preserved independently: first=%#v second=%#v", first, second) }
}

func quotedJSON(value string) string {
  encoded, _ := json.Marshal(value)
  return string(encoded)
}
