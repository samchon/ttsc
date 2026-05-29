package linthost

import "testing"

// TestRuleCorpusUnicornNoDocumentCookie verifies unicorn/no-document-cookie
// reports a direct write to `document.cookie`.
//
// Both reads and assignments share the same `PropertyAccessExpression` shape
// in the AST, so the assignment fixture pins the property-access visit AND
// the LHS-in-assignment branch in one case. Identifier-text-driven, mirroring
// `unicorn/no-process-exit`.
//
// 1. Enable unicorn/no-document-cookie via an expect annotation.
// 2. Write a string to `document.cookie`.
// 3. Assert the property access is reported.
func TestRuleCorpusUnicornNoDocumentCookie(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-document-cookie.ts", "// expect: unicorn/no-document-cookie error\ndocument.cookie = \"name=value\";\n")
}
