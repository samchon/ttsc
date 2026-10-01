package linthost

import "testing"

// TestBoundariesDependenciesNormalizesWindowsAndPosixPaths verifies element and
// local-path selectors are host-independent.
//
// LSP, CLI, and project identity paths can cross separator conventions even on
// one host. Classification must normalize literal backslashes before applying
// glob semantics rather than relying on the current operating system alone.
//
// 1. Classify synthetic Windows and POSIX absolute paths with slash globs.
// 2. Match a backslash selector against the resulting element-local path.
// 3. Assert both elements and the private-path glob match identically.
//
// @evidence contracts/testing.md#behavioral-verification classifyBoundaryFile produces equivalent element/local-path meaning for Windows and POSIX path spellings, and backslash private globs match normalized paths.
// @evidence contracts/testing.md#independent-expectations Authored source segments place main.ts in app and internal/model.ts in domain; literal normalized paths express the portable boundary contract independently.
// @evidence contracts/testing.md#distinguishing-cases Drive/backslash and POSIX absolute inputs plus a backslash private selector exercise data normalization in one process, without an OS matrix.
// @evidence contracts/testing.md#execution-ownership The Test calls classifyBoundaryFile for the Windows and POSIX literal paths and matchBoundaryElementLocalPattern for the private glob. These pure operation calls run in the Go process, with no real platform installation.
func TestBoundariesDependenciesNormalizesWindowsAndPosixPaths(t *testing.T) {
  elements := []boundaryElement{
    {Type: "app", Pattern: "src/app/**"},
    {Type: "domain", Pattern: "src/domain/**", Private: boundaryStringList{`internal\**`}},
  }
  app := classifyBoundaryFile(`C:\repo\src\app\main.ts`, elements)
  domain := classifyBoundaryFile(`/repo/src/domain/internal/model.ts`, elements)
  if app == nil || app.Type != "app" || app.LocalPath != "main.ts" {
    t.Fatalf("Windows app classification = %+v", app)
  }
  if domain == nil || domain.Type != "domain" || domain.LocalPath != "internal/model.ts" {
    t.Fatalf("POSIX domain classification = %+v", domain)
  }
  if !matchBoundaryElementLocalPattern(domain.Private, domain) {
    t.Fatalf("backslash private selector did not match %+v", domain)
  }
}
