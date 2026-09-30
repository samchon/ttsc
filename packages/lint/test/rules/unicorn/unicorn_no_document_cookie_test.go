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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a direct document.cookie assignment bypasses the cookie-store API; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-document-cookie annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the cookie-store API carries the same name and value. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoDocumentCookie is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoDocumentCookie(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-document-cookie.ts", "// expect: unicorn/no-document-cookie error\ndocument.cookie = \"name=value\";\n")
  assertRuleSkipsSource(t, "unicorn/no-document-cookie", "cookieStore.set(\"name\", \"value\");\n")
}
