package main

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
	_ "unsafe"
)

//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

func captureCommand(t *testing.T, fn func() int) (int, string, string) {
	t.Helper()
	prevOut, prevErr, prevGetwd := stdout, stderr, getwd
	var out, err bytes.Buffer
	stdout = &out
	stderr = &err
	t.Cleanup(func() {
		stdout = prevOut
		stderr = prevErr
		getwd = prevGetwd
	})
	code := fn()
	return code, out.String(), err.String()
}

func failGetwd() (string, error) {
	return "", errors.New("cwd boom")
}

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

func resetCommandLinkedPluginRegistry() {
	driverPluginRegistry = nil
}
