package driver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestProgramEnvRecordsHostReads Verifies a host that owns its Program can read
// an environment variable as a recorded input of that generation.
//
// An executable plugin host loads its Program itself and never receives a
// PluginContext, so its only read was os.Getenv, which nothing records
// (samchon/ttsc#1852).
//
// 1. Load a Program and read a set variable, an unset one and an invalid name.
// 2. Change the process environment and read the same names again.
// 3. Assert the returned values and the generation's recorded inputs.
//
// @evidence contracts/testing.md#behavioral-verification An actual loaded Program serves the reads and reports its ledger; returned values and PluginEnvironmentInputs are compared directly.
// @evidence contracts/testing.md#independent-expectations The authored values set through the test's own environment are the expected reads and records; absence is expected for a name the test never sets.
// @evidence contracts/testing.md#distinguishing-cases A set variable, an unset variable, an invalid name, a value changed after its first read and a nil Program separate recording, absence, refusal, first-read fixing and the unrecorded fallback.
// @evidence contracts/testing.md#execution-ownership Go discovers this driver unit directly. It loads one owned temporary project in process, sets variables through t.Setenv and closes the Program; no consumer or native host is built.
func TestProgramEnvRecordsHostReads(t *testing.T) {
  root := t.TempDir()
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
    t.Fatal(err)
  }
  for name, text := range map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"es2022","module":"commonjs","types":[]},"include":["src"]}`,
    "src/main.ts":   "export const value = 1;\n",
  } {
    if err := os.WriteFile(filepath.Join(root, filepath.FromSlash(name)), []byte(text), 0o600); err != nil {
      t.Fatal(err)
    }
  }
  t.Setenv("TTSC_TEST_HOST_READ", "first")
  if err := os.Unsetenv("TTSC_TEST_HOST_UNSET"); err != nil {
    t.Fatal(err)
  }
  if value, ok := (*Program)(nil).Env("TTSC_TEST_HOST_READ"); !ok || value != "first" {
    t.Fatalf("nil program read = %q, %v", value, ok)
  }
  prog, diagnostics, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{})
  if err != nil || len(diagnostics) != 0 {
    t.Fatalf("load: %v %v", err, diagnostics)
  }
  defer prog.Close()
  if recorded := prog.PluginEnvironmentInputs(); len(recorded) != 0 {
    t.Fatalf("a program that read nothing recorded %v", recorded)
  }
  if value, ok := prog.Env("TTSC_TEST_HOST_READ"); !ok || value != "first" {
    t.Fatalf("set variable read = %q, %v", value, ok)
  }
  if value, ok := prog.Env("TTSC_TEST_HOST_UNSET"); ok || value != "" {
    t.Fatalf("unset variable read = %q, %v", value, ok)
  }
  if value, ok := prog.Env("TTSC_TEST=INVALID"); ok || value != "" {
    t.Fatalf("invalid name read = %q, %v", value, ok)
  }
  // The first read fixed the value for the generation.
  t.Setenv("TTSC_TEST_HOST_READ", "second")
  if value, ok := prog.Env("TTSC_TEST_HOST_READ"); !ok || value != "first" {
    t.Fatalf("repeated read = %q, %v", value, ok)
  }
  recorded := prog.PluginEnvironmentInputs()
  if len(recorded) != 2 {
    t.Fatalf("recorded inputs = %v", recorded)
  }
  if value := recorded["TTSC_TEST_HOST_READ"]; value == nil || *value != "first" {
    t.Fatalf("recorded set variable = %v", value)
  }
  if value, found := recorded["TTSC_TEST_HOST_UNSET"]; !found || value != nil {
    t.Fatalf("recorded unset variable = %v, %v", value, found)
  }
}
