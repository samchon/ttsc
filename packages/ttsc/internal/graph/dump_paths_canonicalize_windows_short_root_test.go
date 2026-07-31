//go:build windows

package graph

import (
  "path/filepath"
  "testing"
)

// TestDumpPathMapperCanonicalizesWindowsShortRoot verifies that a project
// selected through an 8.3 path still owns checker sources reported through the
// expanded physical spelling.
//
//  1. Obtain the environment's temp spelling and its physical spelling.
//  2. Skip hosts where Windows exposes only one spelling.
//  3. Require a physical child source to retain a project-relative identity.
func TestDumpPathMapperCanonicalizesWindowsShortRoot(t *testing.T) {
  project := t.TempDir()
  physical, err := filepath.EvalSymlinks(project)
  if err != nil {
    t.Fatal(err)
  }
  if filepath.Clean(project) == filepath.Clean(physical) {
    t.Skip("temporary directory has no alternate Windows path spelling")
  }

  mapper := newDumpPathMapper(project)
  source := filepath.Join(physical, "src", "main.ts")
  if got := mapper.mapPath(source); got != "src/main.ts" {
    t.Fatalf("mapPath(%q) = %q, want project-relative identity", source, got)
  }
  if err := mapper.err(); err != nil {
    t.Fatal(err)
  }
}
