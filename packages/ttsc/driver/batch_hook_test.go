package driver

import (
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// TestLoadProgramBatchHookSignalsOncePerProcessAndSkipsSession verifies
// LoadProgram calls the compiler shim's BeginBatchOnce gate at the right
// lifecycle moments and NewSession never calls it.
//
//  1. Load a failing missing tsconfig; assert beginBatchOnce is not called.
//  2. Load two Programs via LoadProgram over a source-reading FS wrapper;
//     assert beginBatchOnce runs before source reads, every source file is
//     bound and the returned programBound callback runs before LoadProgram
//     returns and before Diagnostics on each load.
//  3. Load a resident NewSession; assert beginBatchOnce is never called.
//
// @evidence contracts/testing.md#behavioral-verification Exercises real LoadProgram and NewSession with a recording stub on the package-level beginBatchOnce seam, verifying call timing around real source reads, file IsBound state and Diagnostics.
// @evidence contracts/testing.md#independent-expectations The begin -> read-source -> bound -> diagnostics ordering, bound source files before LoadProgram returns, zero calls on config failure and zero calls on NewSession come directly from the driver batch contract rather than the implementation.
// @evidence contracts/testing.md#distinguishing-cases Missing tsconfig, first and second LoadProgram calls and resident NewSession separate failed load, per-program binding callbacks and resident exclusion; TTSC_BATCH gating and once-per-process deduplication are owned by shim/compiler's batch_test.go.
// @evidence contracts/testing.md#execution-ownership Go discovers this whitebox driver unit in package driver. It creates one temporary TypeScript project, restores beginBatchOnce via t.Cleanup and builds no native host.
func TestLoadProgramBatchHookSignalsOncePerProcessAndSkipsSession(t *testing.T) {
  root := writeMinimalBatchTestProject(t)

  t.Run("LoadProgram calls gate before parse and signals bound before Diagnostics", func(t *testing.T) {
    var events []string
    installBatchGateStubForTest(t, func() func() {
      events = append(events, "begin-gate")
      return func() {
        events = append(events, "bound")
      }
    })

    // A missing config fails before program construction and never calls the gate.
    if _, _, err := LoadProgram(root, "missing-tsconfig.json", LoadProgramOptions{}); err == nil {
      t.Fatal("expected error for missing tsconfig")
    }
    if len(events) != 0 {
      t.Fatalf("missing tsconfig triggered batch events: %v", events)
    }

    firstFS := &recordingBatchSourceFS{
      FS:     DefaultFS(),
      suffix: "/src/main.ts",
      onRead: func() { events = append(events, "read-source") },
    }
    first, diags, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{FS: firstFS})
    if err != nil || len(diags) != 0 || first == nil {
      t.Fatalf("first LoadProgram: prog=%v diags=%v err=%v", first, diags, err)
    }
    defer first.Close()

    wantBeforeDiag := []string{"begin-gate", "read-source", "bound"}
    if !slices.Equal(events, wantBeforeDiag) {
      t.Fatalf("events after first LoadProgram = %v, want %v", events, wantBeforeDiag)
    }
    for _, file := range first.TSProgram.SourceFiles() {
      if file != nil && !file.IsBound() {
        t.Fatalf("source file %s was not bound before LoadProgram returned", file.FileName())
      }
    }

    if gotDiags := first.Diagnostics(); len(gotDiags) != 0 {
      t.Fatalf("first Diagnostics = %v", gotDiags)
    }
    events = append(events, "diagnostics")

    secondFS := &recordingBatchSourceFS{
      FS:     DefaultFS(),
      suffix: "/src/main.ts",
      onRead: func() { events = append(events, "read-source") },
    }
    second, diags, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{FS: secondFS})
    if err != nil || len(diags) != 0 || second == nil {
      t.Fatalf("second LoadProgram: prog=%v diags=%v err=%v", second, diags, err)
    }
    defer second.Close()

    wantAfterSecond := []string{"begin-gate", "read-source", "bound", "diagnostics", "begin-gate", "read-source", "bound"}
    if !slices.Equal(events, wantAfterSecond) {
      t.Fatalf("events after second LoadProgram = %v, want %v", events, wantAfterSecond)
    }
    for _, file := range second.TSProgram.SourceFiles() {
      if file != nil && !file.IsBound() {
        t.Fatalf("second program source file %s was not bound before LoadProgram returned", file.FileName())
      }
    }
  })

  t.Run("NewSession never calls gate", func(t *testing.T) {
    var gateCalls, boundCalls int
    installBatchGateStubForTest(t, func() func() {
      gateCalls++
      return func() { boundCalls++ }
    })

    session, diags, err := NewSession(root, "tsconfig.json", LoadProgramOptions{})
    if err != nil || len(diags) != 0 || session == nil {
      t.Fatalf("NewSession: session=%v diags=%v err=%v", session, diags, err)
    }
    defer session.Close()

    if gateCalls != 0 || boundCalls != 0 {
      t.Fatalf("NewSession called batch gate: gate=%d bound=%d", gateCalls, boundCalls)
    }
  })
}

type recordingBatchSourceFS struct {
  vfs.FS
  suffix   string
  recorded bool
  onRead   func()
}

func (r *recordingBatchSourceFS) ReadFile(filePath tspath.RootedFilePath) (string, bool) {
  if !r.recorded && strings.HasSuffix(filepath.ToSlash(string(filePath)), r.suffix) {
    r.recorded = true
    r.onRead()
  }
  return r.FS.ReadFile(filePath)
}

func installBatchGateStubForTest(t *testing.T, stub func() func()) {
  t.Helper()
  saved := beginBatchOnce
  beginBatchOnce = stub
  t.Cleanup(func() {
    beginBatchOnce = saved
  })
}

func writeMinimalBatchTestProject(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
    t.Fatal(err)
  }
  for name, text := range map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"es2022","module":"commonjs","types":[]},"include":["src"]}`,
    "src/main.ts":   "export const value: number = 1;\n",
  } {
    if err := os.WriteFile(filepath.Join(root, filepath.FromSlash(name)), []byte(text), 0o600); err != nil {
      t.Fatal(err)
    }
  }
  return root
}
