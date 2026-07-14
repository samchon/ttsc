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
