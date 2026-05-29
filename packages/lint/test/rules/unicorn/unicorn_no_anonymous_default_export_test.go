package linthost

import "testing"

// TestRuleCorpusUnicornNoAnonymousDefaultExport verifies the rule reports
// an `export default function () { … }` whose function expression has no
// name.
//
// `export default` parses as `KindExportAssignment`. When the
// expression is a `KindFunctionExpression` whose `.Name()` is nil, the
// exported value contributes no identifier to the local module — every
// downstream importer must invent one. The fixture pins that branch.
//
// 1. Enable unicorn/no-anonymous-default-export via an expect annotation.
// 2. Write `export default function () { return 1; }`.
// 3. Assert the export statement is reported.
func TestRuleCorpusUnicornNoAnonymousDefaultExport(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-anonymous-default-export.ts", "// expect: unicorn/no-anonymous-default-export error\nexport default function () {\n  return 1;\n}\n")
}
