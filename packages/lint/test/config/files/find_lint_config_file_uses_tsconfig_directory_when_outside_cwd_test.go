package main

import (
	"path/filepath"
	"testing"
)

// TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd verifies find lint config file uses
// tsconfig directory when outside cwd.
//
// Config discovery is directory-sensitive because projects may wrap tsconfig files or keep lint
// config in a nearer package folder. These tests use real temporary paths to validate that
// search order and conflict detection match the host contract.
//
// This scenario focuses on find lint config file uses tsconfig directory when outside cwd. It
// keeps path resolution behavior independent from rule parsing so discovery regressions are
// caught at the source.
//
// 1. Materialize the directory layout and candidate config files.
// 2. Run the discovery or explicit-path resolver helper.
// 3. Assert the selected path or the conflict diagnostic.
func TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
	dir := t.TempDir()
	wrapperDir := t.TempDir()
	wrapper := filepath.Join(wrapperDir, "tsconfig.json")
	writeFile(t, wrapper, "{}")
	writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "no-console": "error"
  }`)
	writeFile(t, filepath.Join(wrapperDir, "lint.config.json"), `{
    "no-var": "error"
  }`)

	discovered, err := findLintConfigFile(dir, wrapper)
	if err != nil {
		t.Fatalf("findLintConfigFile: %v", err)
	}
	if discovered != filepath.Join(wrapperDir, "lint.config.json") {
		t.Fatalf("unexpected discovery path: %s", discovered)
	}
}
