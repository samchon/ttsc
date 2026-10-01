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
// @evidence contracts/testing.md#execution-ownership This Windows-only Go E2E entry calls the actual host API and filesystem metadata. It is absent from non-Windows discovery; a skip does not prove the mapping assertions executed.
// @evidence contracts/e2e.md#necessary-boundary Only a real Windows 8.3 alias can establish the alternate-spelling/physical-root connection; pure lexical path units cannot produce that native equivalence.
// @evidence contracts/e2e.md#shared-execution One owned temporary directory serves the API capability check and all original mapping assertions in one Go host. No compiler load, binary build, installed consumer or child process is added.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The Go test owns the long temporary directory; the accepted short spelling is verified against that same native object. No fabricated short name or filesystem-wide 8.3 setting is used, and TempDir cleanup owns the actual directory.
// @evidence contracts/e2e.md#preserved-coverage The original physical-source, stable missing-root and mapper-error assertions remain unchanged after obtaining a genuine short spelling. Unsupported capability remains explicit noncoverage; portable path units do not claim Windows alias execution.
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
