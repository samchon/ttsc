package lspserver

import (
  "net/url"
  "os"
  "path/filepath"
  "testing"
)

// TestLSPReloadDirectoriesSeparateGlobTerritory verifies the native LSP host
// applies the same data-versus-selection boundary as the CLI watcher.
//
// A reload directory records resolution topology, but a declared glob's
// literal root appearing strictly below it is an ordinary data-population
// transition. Restarting the JavaScript launcher for that event loses the
// resident process that should instead reload its Program.
//
//  1. Create a missing glob root directly inside a reload directory and prove
//     it remains on the warm data lane.
//  2. Prove unrelated immediate entries and the directory itself remain cold.
//  3. Prove exact reload files are never exempt inside glob territory.
//  4. Prove a glob rooted on or above the reload directory exempts nothing.
func TestLSPReloadDirectoriesSeparateGlobTerritory(t *testing.T) {
  uri := func(location string) string {
    normalized := filepath.ToSlash(location)
    if filepath.VolumeName(location) != "" {
      normalized = "/" + normalized
    }
    return (&url.URL{Scheme: "file", Path: normalized}).String()
  }
  snapshot := func(
    root string,
    globs []string,
    reloadFiles []string,
  ) LSPProjectInputSnapshot {
    normalized, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root:              root,
        Globs:             globs,
        ReloadFiles:       reloadFiles,
        ReloadDirectories: []string{root},
      },
      root,
    )
    if err != nil {
      t.Fatalf("normalize project inputs: %v", err)
    }
    return normalized
  }
  created := fileChangeTypeCreated
  changed := fileChangeTypeChanged

  t.Run("literal root is data", func(t *testing.T) {
    root := t.TempDir()
    globRoot := filepath.Join(root, "api")
    source := &NativePluginSource{
      projectInputs: snapshot(
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        nil,
      ),
    }
    if err := os.Mkdir(globRoot, 0o755); err != nil {
      t.Fatal(err)
    }
    if source.ProjectInputReloadMatchesChange(uri(globRoot), &created) {
      t.Fatal("declared glob root selected a cold launcher restart")
    }

    source.projectInputs = snapshot(
      root,
      []string{filepath.Join(globRoot, "**", "*.json")},
      nil,
    )
    selectionEntry := filepath.Join(root, "new-package")
    if err := os.Mkdir(selectionEntry, 0o755); err != nil {
      t.Fatal(err)
    }
    if !source.ProjectInputReloadMatchesChange(uri(selectionEntry), &created) {
      t.Fatal("unrelated immediate entry did not select a cold restart")
    }
    if !source.ProjectInputReloadMatchesChange(uri(root), &changed) {
      t.Fatal("reload-directory identity event depended on its change type")
    }
  })

  t.Run("exact file is never data", func(t *testing.T) {
    root := t.TempDir()
    globRoot := filepath.Join(root, "api")
    reloadFile := filepath.Join(globRoot, "selection.json")
    source := &NativePluginSource{
      projectInputs: snapshot(
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        []string{reloadFile},
      ),
    }
    if err := os.Mkdir(globRoot, 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(reloadFile, []byte("{}"), 0o644); err != nil {
      t.Fatal(err)
    }
    if !source.ProjectInputReloadMatchesChange(uri(reloadFile), &created) {
      t.Fatal("exact reload file was exempted by surrounding glob territory")
    }
  })

  t.Run("symlinked literal root is data", func(t *testing.T) {
    root := t.TempDir()
    globRoot := filepath.Join(root, "api")
    physicalData := filepath.Join(root, "data")
    if err := os.Mkdir(physicalData, 0o755); err != nil {
      t.Fatal(err)
    }
    source := &NativePluginSource{
      projectInputs: snapshot(
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        nil,
      ),
    }
    if err := os.Symlink(physicalData, globRoot); err != nil {
      t.Skipf("directory symlinks unavailable: %v", err)
    }
    if source.ProjectInputReloadMatchesChange(uri(globRoot), &created) {
      t.Fatal("symlinked glob root lost its physical data identity")
    }
  })

  t.Run("symlinked literal root outside reload directory is selection", func(t *testing.T) {
    root := t.TempDir()
    globRoot := filepath.Join(root, "api")
    physicalData := t.TempDir()
    source := &NativePluginSource{
      projectInputs: snapshot(
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        nil,
      ),
    }
    if err := os.Symlink(physicalData, globRoot); err != nil {
      t.Skipf("directory symlinks unavailable: %v", err)
    }
    if !source.ProjectInputReloadMatchesChange(uri(globRoot), &created) {
      t.Fatal("glob root outside reload directory exempted selection")
    }
  })

  for _, test := range []struct {
    name string
    glob func(string) string
  }{
    {
      name: "rooted on reload directory",
      glob: func(root string) string {
        return filepath.Join(root, "**", "*.json")
      },
    },
    {
      name: "rooted above reload directory",
      glob: func(root string) string {
        return filepath.Join(filepath.Dir(root), "**", "*.json")
      },
    },
  } {
    t.Run(test.name, func(t *testing.T) {
      root := t.TempDir()
      source := &NativePluginSource{
        projectInputs: snapshot(root, []string{test.glob(root)}, nil),
      }
      entry := filepath.Join(root, "new-package")
      if err := os.Mkdir(entry, 0o755); err != nil {
        t.Fatal(err)
      }
      if !source.ProjectInputReloadMatchesChange(uri(entry), &created) {
        t.Fatal("glob at or above reload directory exempted selection entry")
      }
    })
  }
}
