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
// selected through a native 8.3 alias maps two absent child paths relative to
// the same directory, using expanded and short root spellings respectively.
// No checker source file is created or loaded by this entry.
//
//  1. Obtain the owned temporary directory's real Windows 8.3 spelling.
//  2. Confirm distinct spellings name the same native directory; report unavailable capability.
//  3. Require both absent child coordinates to retain project-relative identity.
//
// @evidence contracts/testing.md#behavioral-verification Calls Windows GetShortPathNameW, native SameFile checks and the actual dump path mapper; the same native root's expanded-spelling src/main.ts and short-spelling future/main.ts, neither created, must map to their literal relative coordinates without a latched error.
// @evidence contracts/testing.md#independent-expectations The native API supplies the short spelling of this owned directory, SameFile proves its physical identity, and literal src/main.ts and future/main.ts define the three original mapping/error oracles.
// @evidence contracts/testing.md#distinguishing-cases Distinct 8.3 versus expanded root spellings are authenticated by native SameFile; two absent children exercise existing-ancestor fallback under each spelling. Existing child sources are not tested. Unavailable or nondistinct 8.3 capability is reported as skipped coverage.
// @evidence contracts/testing.md#execution-ownership This Windows-build-tagged Go unit invokes the owning mapper against one actual temporary directory and GetShortPathName metadata, without a compiler Program, installed consumer, product host or artifact build. Non-Windows Go test builds exclude this entry; source inventory selection is separate, and a capability skip does not prove mapping assertions executed.
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
