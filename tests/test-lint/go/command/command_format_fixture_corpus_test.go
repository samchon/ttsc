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
func TestFormatFixtureCorpus(t *testing.T) {
  fixtures := os.Getenv("TTSC_LINT_FORMAT_FIXTURES")
  if fixtures == "" {
    t.Fatal("TTSC_LINT_FORMAT_FIXTURES must name the original format projects")
  }
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
