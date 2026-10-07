//go:build windows

package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestPluginSelectionInputsFollowDirectoryCaseSemantics verifies a plugin
// direct selection currentness distinguishes a new source file differing by
// case, where the directory keeps the two apart.
//
// Folding case on every Windows and macOS directory would be wrong: a Windows
// directory opted into case sensitivity holds Foo.go and foo.go as two files, so
// a new foo.go must not be taken for the recorded Foo.go. The test observes
// currentness directly, without running a session or loading a plugin binary.
//
//  1. Record Foo.go as the only source of a case-sensitive directory, and assert
//     the selection is current.
//  2. Create foo.go beside it, and assert the selection is no longer current.
//  3. On an ordinary directory, assert a recorded name spelled in another case
//     still stands for the file on disk.
//
// @evidence contracts/testing.md#behavioral-verification A new source file differing from a recorded one only by case makes the selection stale in a case-sensitive directory, while on an ordinary directory a differently cased recorded name still stands for the file.
// @evidence contracts/testing.md#independent-expectations Literal true/false currentness expectations rely on separately checked native directory flags: sensitive=true after setup and sensitive=false for the ordinary root. Supplied baseline digests use the actual digest helper, so their independent hash correctness is not certified.
// @evidence contracts/testing.md#distinguishing-cases The sensitive root receives Foo.go followed by a distinct foo.go; the insensitive root contains only Bar.go and supplies the recorded spelling bar.go. The ordinary lane does not create a second differently cased file.
// @evidence contracts/testing.md#execution-ownership This Windows-only Go unit calls actual selection construction/currentness on owned native directories. Existing setup runs fsutil once and skips the whole case on its failure; this does not identify every failure as unavailable capability. Native flag queries establish accepted premises, and no Go build, plugin sidecar, installed consumer or product host runs.
func TestPluginSelectionInputsFollowDirectoryCaseSemantics(t *testing.T) {
  sensitive := t.TempDir()
  enableProjectInputCaseSensitivity(t, sensitive)
  if enabled, known := tryQueryProjectInputDirectoryCaseSensitivity(sensitive); !known || !enabled {
    t.Fatalf("case-sensitive fixture premise is unconfirmed: enabled=%v known=%v", enabled, known)
  }
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
  if enabled, known := tryQueryProjectInputDirectoryCaseSensitivity(ordinary); !known || enabled {
    t.Fatalf("case-insensitive fixture premise is unconfirmed: enabled=%v known=%v", enabled, known)
  }
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
