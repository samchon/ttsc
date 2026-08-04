package linthost

import (
  "testing"
)

// TestFilesSelectorScopesRulesAwayFromAnImportedSibling verifies a config's own
// `files` selector decides whether rules reach an imported sibling.
//
// The read scope admits the TypeScript an import reached, and rule resolution
// then decides what runs on it. A selector's patterns anchor at the config's
// directory and never match a path above it, so an entry scoped to `src`
// leaves a sibling package out while still governing the project's own files.
// That is the control a consumer has over the widened scope, and it must not
// silence the consumer's own diagnostics along with it.
//
//  1. Give the consumer and the sibling one no-var violation each.
//  2. Run check with an unscoped config and assert both files report.
//  3. Rerun with the rules scoped to `src` and assert only the consumer reports.
func TestFilesSelectorScopesRulesAwayFromAnImportedSibling(t *testing.T) {
  consumer, _ := seedLintSiblingSourceProject(
    t,
    "import { value } from \"../../api/src/index\";\nvar own = value;\nJSON.stringify(own);\n",
    "export var legacy = 1;\nexport const value = legacy;\n",
  )
  seedLintRules(t, consumer, map[string]string{"no-var": "error"})

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 ||
    !diagnosticOutputContains(stderr, "main.ts") ||
    !diagnosticOutputContains(stderr, "index.ts") {
    t.Fatalf("unscoped config did not report both files: code=%d stderr=%q", code, stderr)
  }

  seedLintConfig(t, consumer, map[string]any{
    "files": []any{"src/**/*.ts"},
    "rules": map[string]any{"no-var": "error"},
  })
  code, _, stderr = captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || !diagnosticOutputContains(stderr, "main.ts") {
    t.Fatalf("scoped config stopped reporting the consumer: code=%d stderr=%q", code, stderr)
  }
  if diagnosticOutputContains(stderr, "index.ts") {
    t.Fatalf("scoped config still reported the sibling: %q", stderr)
  }
}
