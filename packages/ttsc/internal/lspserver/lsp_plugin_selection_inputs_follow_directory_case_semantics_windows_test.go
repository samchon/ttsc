//go:build windows

package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestPluginSelectionInputsFollowDirectoryCaseSemantics verifies a plugin
// selection hears a new source file that differs from a recorded one only by
// case, where the directory keeps the two apart.
//
// The host decided whether a listed source file was recorded by folding case
// on every Windows and macOS directory. A Windows directory opted into case
// sensitivity holds Foo.go and foo.go as two files, so a new foo.go was taken
// for the recorded Foo.go and the session kept its old plugin binary
// (samchon/ttsc#1532). The directory's own case semantics now decide.
//
//  1. Record Foo.go as the only source of a case-sensitive directory, and assert
//     the selection is current.
//  2. Create foo.go beside it, and assert the selection is no longer current.
//  3. On an ordinary directory, assert a recorded name spelled in another case
//     still stands for the file on disk.
func TestPluginSelectionInputsFollowDirectoryCaseSemantics(t *testing.T) {
  sensitive := t.TempDir()
  enableProjectInputCaseSensitivity(t, sensitive)
  recorded := filepath.Join(sensitive, "Foo.go")
  if err := os.WriteFile(recorded, []byte("package main\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  inputs, err := newPluginSelectionInputs(NativePluginSelectionInputs{
    SourceFiles: map[string]map[string]string{
      sensitive: {"Foo.go": projectInputReloadFileDigest(recorded)},
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  if !inputs.current() {
    t.Fatal("an unchanged case-sensitive source directory was not current")
  }
  if err := os.WriteFile(
    filepath.Join(sensitive, "foo.go"),
    []byte("package main\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  if inputs.current() {
    t.Fatal("a case-distinct new source was taken for the recorded file")
  }

  ordinary := t.TempDir()
  file := filepath.Join(ordinary, "Bar.go")
  if err := os.WriteFile(file, []byte("package main\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  aliased, err := newPluginSelectionInputs(NativePluginSelectionInputs{
    SourceFiles: map[string]map[string]string{
      ordinary: {"bar.go": projectInputReloadFileDigest(file)},
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  if !aliased.current() {
    t.Fatal("a case alias on an ordinary directory lost its file")
  }
}
