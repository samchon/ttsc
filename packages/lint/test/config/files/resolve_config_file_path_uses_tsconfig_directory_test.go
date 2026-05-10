package main

import (
	"path/filepath"
	"testing"
)

// TestResolveConfigFilePathUsesTsconfigDirectory verifies resolve config file path uses
// tsconfig directory.
//
// Config discovery is directory-sensitive because projects may wrap tsconfig files or keep lint
// config in a nearer package folder. These tests use real temporary paths to validate that
// search order and conflict detection match the host contract.
//
// This scenario focuses on resolve config file path uses tsconfig directory. It keeps path
// resolution behavior independent from rule parsing so discovery regressions are caught at the
// source.
//
// 1. Materialize the directory layout and candidate config files.
// 2. Run the discovery or explicit-path resolver helper.
// 3. Assert the selected path or the conflict diagnostic.
func TestResolveConfigFilePathUsesTsconfigDirectory(t *testing.T) {
	dir := t.TempDir()
	wrapper := filepath.Join(t.TempDir(), "tsconfig.json")
	writeFile(t, wrapper, "{}")

	resolved := resolveConfigFilePath("./lint.config.json", dir, wrapper)
	expected := filepath.Join(filepath.Dir(wrapper), "lint.config.json")
	if resolved != expected {
		t.Fatalf("unexpected explicit config path: got %s, want %s", resolved, expected)
	}
}
