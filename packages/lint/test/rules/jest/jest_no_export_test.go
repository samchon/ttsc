package linthost

import "testing"

// TestRuleCorpusJestNoExport verifies the lint rule corpus fixture jest/no-export.ts.
//
// Exporting from test files can make test modules part of production import
// graphs. This pins both declaration-level export modifiers and export
// statements.
//
// 1. Load a Jest test file with an exported helper value.
// 2. Enable jest/no-export from the annotated expect comment.
// 3. Assert the exported declaration is reported.
func TestRuleCorpusJestNoExport(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-export.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-export error
export const helper = 1;

test("uses helper", () => {
  expect(helper).toBe(1);
});
`)
}
