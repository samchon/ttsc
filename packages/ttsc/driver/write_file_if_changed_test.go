package driver

import (
  "os"
  "path/filepath"
  "testing"
  "time"
)

// TestWriteFileWithWatchMode verifies the watch writer's disk effects and
// fallback against the ordinary writer.
//
// Verifies that only an existing, byte-identical regular file is preserved.
// 1. Write missing and changed outputs in watch mode and read their bytes.
// 2. Mark identical outputs with an old timestamp and compare watch and normal writes.
// 3. Exercise blocked parents, read-only outputs and a symlink against normal writes.
//
// @evidence contracts/testing.md#behavioral-verification The direct disk writer creates and changes real files, preserves an unchanged watch output's timestamp and mode, and still reports native write failures.
// @evidence contracts/testing.md#independent-expectations Authored literal bytes and a fixed old timestamp establish the expected output independently of the writer; normal mode on an equivalent file is the permission/error reference.
// @evidence contracts/testing.md#distinguishing-cases Missing, empty, unchanged, changed same-size, blocked-parent, read-only and symlink outputs separate the skip predicate from writes and error fallback. Compiler emitted-file accounting belongs to its owning host test.
// @evidence contracts/testing.md#execution-ownership This Go unit calls the driver writer with explicit watch mode on temporary native files; no compiler, child host or process environment mutation is required.
func TestWriteFileWithWatchMode(t *testing.T) {
  old := time.Date(2001, time.January, 1, 0, 0, 0, 0, time.UTC)

  t.Run("missing and changed", func(t *testing.T) {
    file := filepath.Join(t.TempDir(), "nested", "out.js")
    if err := writeFileWithWatchMode(file, "first", true); err != nil {
      t.Fatal(err)
    }
    if err := writeFileWithWatchMode(file, "other", true); err != nil {
      t.Fatal(err)
    }
    data, err := os.ReadFile(file)
    if err != nil || string(data) != "other" {
      t.Fatalf("changed output = %q, %v", data, err)
    }
    if err := writeFileWithWatchMode(file, "", true); err != nil {
      t.Fatal(err)
    }
    data, err = os.ReadFile(file)
    if err != nil || len(data) != 0 {
      t.Fatalf("empty output = %q, %v", data, err)
    }
    if err := os.Chtimes(file, old, old); err != nil {
      t.Fatal(err)
    }
    if err := writeFileWithWatchMode(file, "", true); err != nil {
      t.Fatal(err)
    }
    info, err := os.Stat(file)
    if err != nil || !info.ModTime().Equal(old) {
      t.Fatalf("empty output was rewritten: %v, %v", info, err)
    }
  })

  t.Run("identical watch and ordinary output", func(t *testing.T) {
    root := t.TempDir()
    watch := filepath.Join(root, "watch.js")
    normal := filepath.Join(root, "normal.js")
    for _, file := range []string{watch, normal} {
      if err := os.WriteFile(file, []byte("same"), 0o600); err != nil {
        t.Fatal(err)
      }
      if err := os.Chtimes(file, old, old); err != nil {
        t.Fatal(err)
      }
    }
    before, err := os.Stat(watch)
    if err != nil {
      t.Fatal(err)
    }
    if err := writeFileWithWatchMode(watch, "same", true); err != nil {
      t.Fatal(err)
    }
    after, err := os.Stat(watch)
    if err != nil {
      t.Fatal(err)
    }
    if !after.ModTime().Equal(before.ModTime()) || after.Mode() != before.Mode() {
      t.Fatalf("unchanged watch metadata changed: before=%v after=%v", before, after)
    }
    if err := writeFileWithWatchMode(normal, "same", false); err != nil {
      t.Fatal(err)
    }
    normalAfter, err := os.Stat(normal)
    if err != nil {
      t.Fatal(err)
    }
    if normalAfter.ModTime().Equal(old) {
      t.Fatal("ordinary identical output was not rewritten")
    }
  })

  t.Run("blocked parent", func(t *testing.T) {
    parent := filepath.Join(t.TempDir(), "parent")
    if err := os.WriteFile(parent, []byte("file"), 0o600); err != nil {
      t.Fatal(err)
    }
    if err := writeFileWithWatchMode(filepath.Join(parent, "out.js"), "x", true); err == nil {
      t.Fatal("watch writer accepted a blocked parent")
    }
  })

  t.Run("read-only output", func(t *testing.T) {
    root := t.TempDir()
    watch := filepath.Join(root, "watch.js")
    normal := filepath.Join(root, "normal.js")
    for _, file := range []string{watch, normal} {
      if err := os.WriteFile(file, []byte("same"), 0o600); err != nil {
        t.Fatal(err)
      }
      if err := os.Chmod(file, 0o400); err != nil {
        t.Fatal(err)
      }
    }
    watchErr := writeFileWithWatchMode(watch, "same", true)
    normalErr := writeFileWithWatchMode(normal, "same", false)
    if (watchErr == nil) != (normalErr == nil) {
      t.Fatalf("read-only write error differs: watch=%v normal=%v", watchErr, normalErr)
    }
  })

  t.Run("symlink output", func(t *testing.T) {
    root := t.TempDir()
    target := filepath.Join(root, "target.js")
    link := filepath.Join(root, "link.js")
    if err := os.WriteFile(target, []byte("same"), 0o600); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(target, link); err != nil {
      t.Skipf("symlink unavailable: %v", err)
    }
    if err := os.Chtimes(target, old, old); err != nil {
      t.Fatal(err)
    }
    if err := writeFileWithWatchMode(link, "same", true); err != nil {
      t.Fatal(err)
    }
    info, err := os.Lstat(link)
    if err != nil || info.Mode()&os.ModeSymlink == 0 {
      t.Fatalf("output symlink was replaced: %v, %v", info, err)
    }
    targetInfo, err := os.Stat(target)
    if err != nil || targetInfo.ModTime().Equal(old) {
      t.Fatalf("symlink target was not rewritten: %v, %v", targetInfo, err)
    }
  })
}
