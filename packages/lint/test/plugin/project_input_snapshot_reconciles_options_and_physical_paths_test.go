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
  if first.Root != filepath.ToSlash(realProjectPath(physicalRoot)) ||
    second.Root != first.Root {
    t.Fatalf("physical roots = %q then %q, want %q", first.Root, second.Root, physicalRoot)
  }
  wantFiles := []string{filepath.ToSlash(filepath.Join(physicalRoot, "docs", "new.md"))}
  wantGlobs := []string{filepath.ToSlash(filepath.Join(physicalRoot, "api", "new", "**", "*.yaml"))}
  if !reflect.DeepEqual(second.Files, wantFiles) {
    t.Fatalf("replacement files = %#v, want %#v", second.Files, wantFiles)
  }
  if !reflect.DeepEqual(second.Globs, wantGlobs) {
    t.Fatalf("replacement globs = %#v, want %#v", second.Globs, wantGlobs)
  }
}

func quotedJSON(value string) string {
  encoded, _ := json.Marshal(value)
  return string(encoded)
}
