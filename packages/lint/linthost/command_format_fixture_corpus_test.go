package linthost

import (
  "io/fs"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestFormatFixtureCorpus verifies every original format project's exact bytes.
//
// Rule combinations, cascades, CRLF and template interiors use the checked-in
// expectations through the real format command. One launcher integration keeps
// plugin dispatch covered without compiling and spawning a plugin per fixture.
//
// 1. Copy each complete fixture into its own writable temporary project.
// 2. Run the production format command with the original config and program.
// 3. Assert success, silent diagnostics, exact output and immutable inputs.
//
// @evidence contracts/testing.md#behavioral-verification RunFormat transforms every original format project in an isolated writable copy, returns success without format diagnostics and writes exact authored expected/main.ts bytes; every original fixture file must retain its input bytes.
// @evidence contracts/testing.md#independent-expectations The original expected/main.ts files are authored formatting oracles, not outputs generated during this test. The retained input tree independently establishes the immutability expectation; input/oracle presence checks validate fixture roles rather than committed repository layout.
// @evidence contracts/testing.md#distinguishing-cases Owns the complete original format-project population with its rule combinations, cascades, line endings and template contents; per-project copies prevent one writable result from contaminating another case, and an empty fixture population fails rather than silently certifying coverage.
// @evidence contracts/testing.md#execution-ownership TestFormatFixtureCorpus is the discoverable Go entry; directory-named subcases are dynamic rather than separately addressable Evidence declarations. Real RunFormat config and program operations share the selected Go process without a native producer per fixture; the separate launcher E2E batch owns executable plugin dispatch.
func TestFormatFixtureCorpus(t *testing.T) {
  fixtures := lintFormatProjectsRoot
  entries, err := os.ReadDir(fixtures)
  if err != nil {
    t.Fatal(err)
  }
  cases := 0
  for _, entry := range entries {
    if !entry.IsDir() {
      continue
    }
    cases++
    t.Run(entry.Name(), func(t *testing.T) {
      fixture := filepath.Join(fixtures, entry.Name())
      original := formatFixtureTree(t, fixture)
      root := filepath.Join(t.TempDir(), "project")
      for relative, content := range original {
        file := filepath.Join(root, relative)
        if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(file, content, 0o644); err != nil {
          t.Fatal(err)
        }
      }
      expected, ok := original[filepath.Join("expected", "main.ts")]
      if !ok {
        t.Fatal("fixture has no original expected/main.ts oracle")
      }
      if _, ok := original[filepath.Join("src", "main.ts")]; !ok {
        t.Fatal("fixture has no original src/main.ts input")
      }
      code, _, stderr := captureCommandOutput(t, func() int {
        return RunFormat([]string{"--cwd", root, "--plugins-json", lintManifest(t)})
      })
      if code != 0 {
        t.Errorf("format returned %d: %s", code, stderr)
      }
      if strings.Contains(stderr, "[format/") {
        t.Errorf("write-only format emitted diagnostics: %s", stderr)
      }
      assertFileText(t, filepath.Join(root, "src", "main.ts"), string(expected))
      for relative, content := range original {
        assertFileText(t, filepath.Join(fixture, relative), string(content))
      }
    })
  }
  if cases == 0 {
    t.Fatal("format fixture corpus ran no projects")
  }
}

func formatFixtureTree(t *testing.T, root string) map[string][]byte {
  t.Helper()
  files := make(map[string][]byte)
  err := filepath.WalkDir(root, func(file string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if entry.IsDir() {
      return nil
    }
    if !entry.Type().IsRegular() {
      t.Fatalf("format fixture contains a non-regular file: %s", file)
    }
    relative, err := filepath.Rel(root, file)
    if err != nil {
      return err
    }
    content, err := os.ReadFile(file)
    if err != nil {
      return err
    }
    files[relative] = content
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  return files
}
