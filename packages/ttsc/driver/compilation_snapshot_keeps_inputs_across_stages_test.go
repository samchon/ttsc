package driver

import (
  "os"
  "path/filepath"
  "reflect"
  "sync"
  "testing"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// TestCompilationSnapshotKeepsInputsAcrossStages verifies captured text,
// absence, identity and directory answers survive edits and stage handoff.
// A disk comparison cannot establish which bytes an earlier compiler used.
//
// 1. Read authored existing, empty and missing files and directory membership.
// 2. Edit and create those paths, then read concurrently and from a new stage.
// 3. Open a new invocation and require it to observe the edited inputs.
//
// @evidence contracts/testing.md#behavioral-verification The actual snapshot VFS serves old text and absence after disk mutation, persists those answers to another stage and admits new bytes only in a new invocation.
// @evidence contracts/testing.md#independent-expectations Literal BEFORE, AFTER, empty and missing states, authored Unicode/invalid byte text and the original directory listing define the oracle independently of snapshot serialization.
// @evidence contracts/testing.md#distinguishing-cases Existing, empty, Unicode plus invalid UTF-8 text, failed reads, missing existence, returned slice mutation, concurrent readers, sequential stage handoff and a new invocation exercise distinct read-once boundaries; malformed transport must fail.
// @evidence contracts/testing.md#execution-ownership This in-process driver Go unit calls its maintained VFS directly over a private temporary tree; it starts no compiler, installation or product host.
func TestCompilationSnapshotKeepsInputsAcrossStages(t *testing.T) {
  root := t.TempDir()
  source := filepath.Join(root, "source.ts")
  empty := filepath.Join(root, "empty.ts")
  encoded := filepath.Join(root, "encoded.ts")
  encodedText := "// \xff\x80\nexport const value = \"한글😀\";\n"
  missing := filepath.Join(root, "missing.ts")
  write := func(file, text string) {
    t.Helper()
    if err := os.WriteFile(file, []byte(text), 0600); err != nil {
      t.Fatal(err)
    }
  }
  write(source, "BEFORE")
  write(empty, "")
  write(encoded, encodedText)
  newDocument := func(id string) string {
    t.Helper()
    file := filepath.Join(t.TempDir(), "snapshot.json")
    write(file, `{"version":1,"id":"`+id+`","reads":{},"files":{},"directories":{},"entries":{},"realpaths":{},"stats":{}}`)
    return file
  }
  document := newDocument("first")
  first, err := openCompilationSnapshot(DefaultFS(), document)
  if err != nil {
    t.Fatal(err)
  }
  file := shimtspath.RootedFilePathFromAbsolute(source)
  absent := shimtspath.RootedFilePathFromAbsolute(missing)
  directory := shimtspath.RootedDirectoryPathFromAbsolute(root)
  if text, ok := first.ReadFile(file); !ok || text != "BEFORE" {
    t.Fatalf("first read: %q %v", text, ok)
  }
  if text, ok := first.ReadFile(shimtspath.RootedFilePathFromAbsolute(empty)); !ok || text != "" {
    t.Fatalf("empty read: %q %v", text, ok)
  }
  if _, ok := first.ReadFile(absent); ok || first.FileExists(absent) {
    t.Fatal("missing input was present")
  }
  if !first.DirectoryExists(directory) {
    t.Fatal("source directory missing")
  }
  if text, ok := first.ReadFile(shimtspath.RootedFilePathFromAbsolute(encoded)); !ok || text != encodedText {
    t.Fatalf("encoded first read: %q %v", text, ok)
  }
  physical := first.Realpath(shimtspath.RootedPath(shimtspath.RootedFilePathFromAbsolute(source)))
  original := first.GetAccessibleEntries(directory)
  expected := append([]string{}, original.Files...)
  original.Files[0] = "caller mutation"
  write(source, "AFTER")
  write(empty, "FILLED")
  write(encoded, "AFTER")
  write(missing, "CREATED")
  var readers sync.WaitGroup
  for range 8 {
    readers.Go(func() {
      if text, ok := first.ReadFile(file); !ok || text != "BEFORE" {
        t.Errorf("concurrent read: %q %v", text, ok)
      }
    })
  }
  readers.Wait()
  if err := first.save(); err != nil {
    t.Fatal(err)
  }
  second, err := openCompilationSnapshot(DefaultFS(), document)
  if err != nil {
    t.Fatal(err)
  }
  if text, ok := second.ReadFile(file); !ok || text != "BEFORE" {
    t.Fatalf("next stage: %q %v", text, ok)
  }
  if text, ok := second.ReadFile(shimtspath.RootedFilePathFromAbsolute(empty)); !ok || text != "" {
    t.Fatalf("empty next stage: %q %v", text, ok)
  }
  if text, ok := second.ReadFile(shimtspath.RootedFilePathFromAbsolute(encoded)); !ok || text != encodedText {
    t.Fatalf("encoded next stage: %q %v", text, ok)
  }
  if _, ok := second.ReadFile(absent); ok || second.FileExists(absent) {
    t.Fatal("next stage admitted a created input")
  }
  if !reflect.DeepEqual(second.GetAccessibleEntries(directory).Files, expected) {
    t.Fatal("directory answer changed")
  }
  if second.Realpath(shimtspath.RootedPath(shimtspath.RootedFilePathFromAbsolute(source))) != physical {
    t.Fatal("physical source coordinate changed")
  }
  fresh, err := openCompilationSnapshot(DefaultFS(), newDocument("next"))
  if err != nil {
    t.Fatal(err)
  }
  if text, ok := fresh.ReadFile(file); !ok || text != "AFTER" {
    t.Fatalf("new invocation: %q %v", text, ok)
  }
  if !fresh.FileExists(absent) {
    t.Fatal("new invocation missed created source")
  }
  write(document, `{"version":2}`)
  if _, err := openCompilationSnapshot(DefaultFS(), document); err == nil {
    t.Fatal("invalid snapshot accepted")
  }
  write(document, "{")
  if _, err := openCompilationSnapshot(DefaultFS(), document); err == nil {
    t.Fatal("malformed snapshot accepted")
  }
}
