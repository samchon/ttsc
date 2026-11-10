package driver

import (
  "os"
  "path/filepath"
  "testing"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// argumentInterleavingFS returns the actual first response read, then changes
// that owned file before returning control to the parser's caller.
type argumentInterleavingFS struct {
  vfs.FS
  response string
  changed  bool
  t        *testing.T
}

func (fs *argumentInterleavingFS) ReadFile(file shimtspath.RootedFilePath) (string, bool) {
  text, ok := fs.FS.ReadFile(file)
  if filepath.Clean(string(file)) == fs.response && !fs.changed {
    fs.changed = true
    if err := os.WriteFile(fs.response, []byte("--strictNullChecks false\n"), 0600); err != nil {
      fs.t.Fatal(err)
    }
  }
  return text, ok
}

// TestCompilerArgumentsRetainTheParserObservation verifies freshness stays
// attached to the response bytes actually returned during argument parsing.
//
// 1. Load through an owned FS port that edits the real response after reading it.
// 2. Require the old parsed option and reject its reuse against current bytes.
// 3. Load the new value and preserve reuse across unrelated directory membership.
//
// @evidence contracts/testing.md#behavioral-verification Calls real LoadProgram and CompilerArgumentsAreCurrent through an explicit filesystem boundary interleaving; the first Program must retain true while refusing the changed response, and a fresh false Program must qualify for reuse.
// @evidence contracts/testing.md#independent-expectations Literal true/false response contents determine native compiler options; the real edit between read return and loader completion distinguishes original observation from a post-load baseline.
// @evidence contracts/testing.md#distinguishing-cases Contrasts a mid-load response edit with a current fresh load and an unrelated file addition. Graph-session tests retain missing/repair, alias identity and explicit-empty controls.
// @evidence contracts/testing.md#execution-ownership A Go unit owns real temporary source/response files and Programs. LoadProgram's supported FS option receives a task-owned wrapper over the actual native FS; no foreign method or global is replaced and no native executable starts.
func TestCompilerArgumentsRetainTheParserObservation(t *testing.T) {
  root := t.TempDir()
  project, base := filepath.Join(root, "project"), filepath.Join(root, "arguments")
  write := func(file, text string) {
    t.Helper()
    if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0600); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(project, "tsconfig.json"), `{"files":["main.ts"]}`)
  write(filepath.Join(project, "main.ts"), "export const value=1;\n")
  response := filepath.Join(base, "args.rsp")
  write(response, "--strictNullChecks true \n")
  input := &argumentInterleavingFS{FS: DefaultFS(), response: response, t: t}
  options := LoadProgramOptions{TsgoArgs: []string{"@args.rsp"}, TsgoArgsCwd: base, FS: input}
  first, diagnostics, err := LoadProgram(project, "tsconfig.json", options)
  if err != nil || len(diagnostics) != 0 || first == nil {
    t.Fatalf("first load: %v / %v", diagnostics, err)
  }
  defer first.Close()
  if !input.changed || !first.ParsedConfig.CompilerOptions().StrictNullChecks.IsTrue() {
    t.Fatal("the parser did not consume the original response")
  }
  if first.CompilerArgumentsAreCurrent() {
    t.Fatal("a post-load response was attached to the earlier Program")
  }
  options.FS = nil
  current, diagnostics, err := LoadProgram(project, "tsconfig.json", options)
  if err != nil || len(diagnostics) != 0 || current == nil {
    t.Fatalf("current load: %v / %v", diagnostics, err)
  }
  defer current.Close()
  if current.ParsedConfig.CompilerOptions().StrictNullChecks.IsTrue() || !current.CompilerArgumentsAreCurrent() {
    t.Fatal("the fresh response did not qualify its Program")
  }
  write(filepath.Join(base, "unrelated.txt"), "unrelated")
  if !current.CompilerArgumentsAreCurrent() {
    t.Fatal("argument directory identity became membership")
  }
}
