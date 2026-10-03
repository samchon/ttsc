package lspserver

import (
  "errors"
  "net/url"
  "os"
  "path/filepath"
  "runtime"
  "syscall"
  "testing"
)

// TestLSPReloadDirectoriesSeparateGlobTerritory verifies the native LSP host
// reload matcher distinguishes the supplied glob territory and selection paths.
//
// A reload directory records resolution topology, but a declared glob's
// literal root appearing strictly below it is an ordinary data-population
// transition in the direct policy. This unit does not run a CLI watcher,
// JavaScript launcher, resident process or Program reload.
//
//  1. Create a missing glob root directly inside a reload directory and prove
//     it remains on the warm data lane.
//  2. Prove unrelated immediate entries and the directory itself remain cold.
//  3. Prove exact reload files are never exempt inside glob territory.
//  4. Prove a glob rooted on or above the reload directory exempts nothing.
//
// @evidence contracts/testing.md#behavioral-verification Direct reload-policy booleans exempt a newly created literal glob root and its in-root symlink form, but match unrelated immediate entries, the directory itself, an exact reload file, an outside-root symlink target and globs rooted on or above the reload directory. Warm/cold process lifetimes are not observed.
// @evidence contracts/testing.md#independent-expectations Each supplied native mutation has a literal true/false expectation independent of the matcher. Real normalized snapshots establish baselines; no particular digest value or process reuse is certified.
// @evidence contracts/testing.md#distinguishing-cases The six named subtests distinguish below-root territory, exact-file precedence, symlink targets inside/outside the reload directory and globs on/above it. Both symlink cases expose Windows privilege-only skips; other fixture errors fail.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit and its named subtests call actual snapshot normalization and NativePluginSource.ProjectInputReloadMatchesChange over owned temporary native inputs. The snapshot helper receives the current subtest's testing handle for failure ownership. No child, installed consumer, substitute operation or product host is used.
func TestLSPReloadDirectoriesSeparateGlobTerritory(t *testing.T) {
  uri := func(location string) string {
    normalized := filepath.ToSlash(location)
    if filepath.VolumeName(location) != "" {
      normalized = "/" + normalized
    }
    return (&url.URL{Scheme: "file", Path: normalized}).String()
  }
  snapshot := func(
    t *testing.T,
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
        t,
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
      t,
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
        t,
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
        t,
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        nil,
      ),
    }
    if err := os.Symlink(physicalData, globRoot); err != nil {
      if runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(1314)) {
        t.Skipf("Windows symlink privilege is unavailable: %v", err)
      }
      t.Fatalf("create owned directory symlink: %v", err)
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
        t,
        root,
        []string{filepath.Join(globRoot, "**", "*.json")},
        nil,
      ),
    }
    if err := os.Symlink(physicalData, globRoot); err != nil {
      if runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(1314)) {
        t.Skipf("Windows symlink privilege is unavailable: %v", err)
      }
      t.Fatalf("create owned directory symlink: %v", err)
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
        projectInputs: snapshot(t, root, []string{test.glob(root)}, nil),
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
