package linthost

import "testing"

// TestRuleCorpusUnicornNoInvalidFetchOptions verifies
// unicorn/no-invalid-fetch-options reports a `fetch()` call that pairs a
// `GET` method with a `body` property.
//
// The rule matches `fetch(_, { method: "GET" | "HEAD", body })` because the
// runtime throws when GET / HEAD requests carry a body. This fixture pins the
// uppercase-method positive case so the case-insensitive lowering in the
// matcher stays exercised.
//
// 1. Enable unicorn/no-invalid-fetch-options via an expect annotation.
// 2. Call `fetch` with a GET method and a `body` property.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a GET request carries an unsupported body; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-invalid-fetch-options annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a POST request retains the same body. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoInvalidFetchOptions is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoInvalidFetchOptions(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-invalid-fetch-options.ts", "declare function fetch(input: string, init: object): Promise<unknown>;\n// expect: unicorn/no-invalid-fetch-options error\nfetch(\"https://example.com\", { method: \"GET\", body: \"x\" });\n")
  assertRuleSkipsSource(t, "unicorn/no-invalid-fetch-options", "declare function fetch(input: string, init: object): Promise<unknown>; fetch(\"https://example.com\", { method: \"POST\", body: \"x\" });\n")
}
