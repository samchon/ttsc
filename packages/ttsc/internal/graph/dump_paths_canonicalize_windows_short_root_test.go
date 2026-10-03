//go:build windows

package graph

import (
  "os"
  "path/filepath"
  "strings"
  "syscall"
  "testing"
)

// TestDumpPathMapperCanonicalizesWindowsShortRoot verifies that a project
// selected through an 8.3 path still owns checker sources reported through the
// expanded physical spelling.
//
//  1. Obtain the owned temporary directory's real Windows 8.3 spelling.
//  2. Confirm distinct spellings name the same native directory; report unavailable capability.
//  3. Require a physical child source to retain a project-relative identity.
//
// @evidence contracts/testing.md#behavioral-verification Calls Windows GetShortPathNameW, native SameFile checks and the actual dump path mapper; a real alternate spelling must still own physical-source and missing-child coordinates.
// @evidence contracts/testing.md#independent-expectations The native API supplies the short spelling of this owned directory, SameFile proves its physical identity, and literal src/main.ts and future/main.ts define the three original mapping/error oracles.
// @evidence contracts/testing.md#distinguishing-cases Distinct 8.3 versus expanded spellings, a physical source coordinate and a missing lexical child exercise alias-root handling. Unavailable or nondistinct 8.3 capability is reported as skipped coverage.
// @evidence contracts/testing.md#execution-ownership This Windows-only Go unit entry calls the owning path mapper against actual temporary filesystem identities and GetShortPathName metadata, without an installed consumer, product host or artifact build. It is absent from non-Windows discovery; a skip does not prove the mapping assertions executed.
func TestDumpPathMapperCanonicalizesWindowsShortRoot(t *testing.T) {
  owned := t.TempDir()
  long, err := syscall.UTF16PtrFromString(owned)
  if err != nil { t.Fatal(err) }
  required, err := syscall.GetShortPathName(long, nil, 0)
  if err != nil || required == 0 { t.Skipf("Windows short-path capability unavailable: %v", err) }
  buffer := make([]uint16, required)
  length, err := syscall.GetShortPathName(long, &buffer[0], uint32(len(buffer)))
  if err != nil { t.Skipf("Windows short-path capability unavailable: %v", err) }
  if length >= uint32(len(buffer)) { t.Fatal("Windows short-path result exceeded its observed buffer size") }
  project := syscall.UTF16ToString(buffer[:length])
  physical, err := filepath.EvalSymlinks(project)
  if err != nil {
    t.Fatal(err)
  }
  if strings.EqualFold(filepath.Clean(project), filepath.Clean(physical)) {
    t.Skip("owned temporary directory has no distinct Windows 8.3 spelling")
  }
  suppliedInfo, err := os.Stat(project)
  if err != nil { t.Fatal(err) }
  ownedInfo, err := os.Stat(owned)
  if err != nil { t.Fatal(err) }
  if !os.SameFile(suppliedInfo, ownedInfo) { t.Fatal("Windows short spelling does not name the owned native directory") }

  mapper := newDumpPathMapper(project)
  source := filepath.Join(physical, "src", "main.ts")
  if got := mapper.mapPath(source); got != "src/main.ts" {
    t.Fatalf("mapPath(%q) = %q, want project-relative identity", source, got)
  }
  missing := filepath.Join(project, "future", "main.ts")
  if got := mapper.mapPath(missing); got != "future/main.ts" {
    t.Fatalf("mapPath(%q) = %q, want stable missing-root identity", missing, got)
  }
  if err := mapper.err(); err != nil {
    t.Fatal(err)
  }
}
