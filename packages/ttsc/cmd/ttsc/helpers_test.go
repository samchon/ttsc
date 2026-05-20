package main

import (
  "bytes"
  "errors"
  "os"
  "path/filepath"
  "testing"
  _ "unsafe"
)

// driverPluginRegistry is a linkname alias for the unexported plugin slice in
// the driver package, allowing tests to reset registered plugins between cases.
//
//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

// captureCommand redirects the package-level stdout/stderr/getwd seams around
// fn, then returns the exit code and the captured output strings.
func captureCommand(t *testing.T, fn func() int) (int, string, string) {
  t.Helper()
  prevOut, prevErr, prevGetwd := stdout, stderr, getwd
  var out, err bytes.Buffer
  stdout = &out
  stderr = &err
  defer func() {
    stdout = prevOut
    stderr = prevErr
    getwd = prevGetwd
  }()
  code := fn()
  return code, out.String(), err.String()
}

// failGetwd is a getwd stub that always returns an error, used to exercise the
// cwd-resolution failure path in command entrypoints.
func failGetwd() (string, error) {
  return "", errors.New("cwd boom")
}

// writeCommandProjectFile writes contents to root/name, creating intermediate
// directories as needed. Slashes in name are normalised to the OS separator.
func writeCommandProjectFile(t *testing.T, root, name, contents string) {
  t.Helper()
  file := filepath.Join(root, filepath.FromSlash(name))
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// resetCommandLinkedPluginRegistry clears the driver plugin registry so that
// tests that register plugins do not pollute subsequent test cases.
func resetCommandLinkedPluginRegistry() {
  driverPluginRegistry = nil
}
