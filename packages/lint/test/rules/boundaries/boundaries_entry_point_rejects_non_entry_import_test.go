package linthost

import "testing"

// TestBoundariesEntryPointRejectsNonEntryImport verifies boundaries/entry-point
// requires imports into a configured element to land on that element's public
// entry file.
//
// Entry-point enforcement is deliberately path based: it can run during the
// normal lint pass without a TypeScript checker, and it catches deep relative
// imports before they become stable project API.
//
// 1. Materialize a domain element with index.ts and internal.ts files.
// 2. Configure index.ts as the domain entry point.
// 3. Assert the app file's deep import reports while the index import passes.
func TestBoundariesEntryPointRejectsNonEntryImport(t *testing.T) {
	const ruleName = "boundaries/entry-point"
	findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal";
    import "../domain";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**", "entry": "index.ts" }
    ]
  }`, map[string]string{
		"src/domain/index.ts":    "export {};",
		"src/domain/internal.ts": "export {};",
	})
	assertSingleBoundaryFinding(t, ruleName, findings, `entry point`)
}
