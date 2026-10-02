package linthost

import "testing"

// TestBoundariesDependenciesNormalizesWindowsAndPosixPaths checks element and
// local-path selectors on authored separator spellings.
//
// LSP, CLI, and project identity paths can cross separator conventions even on
// one host. Classification must normalize literal backslashes before applying
// glob semantics rather than relying on the current operating system alone.
//
// 1. Classify synthetic Windows and POSIX absolute paths with slash globs.
// 2. Match a backslash selector against the resulting element-local path.
// 3. Assert the literal app/domain types and local paths, then the private glob.
//
// @evidence contracts/testing.md#behavioral-verification classifyBoundaryFile recognizes the authored drive/backslash app path and POSIX domain path with literal local paths; the domain's backslash private glob matches its normalized path. These are distinct fixtures, not a same-path OS comparison.
// @evidence contracts/testing.md#independent-expectations Authored source segments place main.ts in app and internal/model.ts in domain; literal normalized paths express the portable boundary contract independently.
// @evidence contracts/testing.md#distinguishing-cases Drive/backslash and POSIX absolute inputs plus a backslash private selector exercise data normalization in one process, without an OS matrix.
// @evidence contracts/testing.md#execution-ownership The Test calls classifyBoundaryFile for the Windows and POSIX literal paths and matchBoundaryElementLocalPattern for the private glob. These direct data-operation calls run in the Go process; classification also reads the current directory for relative path candidates, but no platform installation is performed.
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
