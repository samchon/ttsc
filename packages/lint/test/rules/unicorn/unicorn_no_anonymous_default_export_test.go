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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an anonymous function is the default export; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-anonymous-default-export annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same default-exported function has a local name. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoAnonymousDefaultExport is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoAnonymousDefaultExport(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-anonymous-default-export.ts", "// expect: unicorn/no-anonymous-default-export error\nexport default function () {\n  return 1;\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-anonymous-default-export", "export default function readValue() { return 1; }\n")
}
