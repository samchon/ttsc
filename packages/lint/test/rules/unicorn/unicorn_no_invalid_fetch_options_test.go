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
func TestRuleCorpusUnicornNoInvalidFetchOptions(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-invalid-fetch-options.ts", "declare function fetch(input: string, init: object): Promise<unknown>;\n// expect: unicorn/no-invalid-fetch-options error\nfetch(\"https://example.com\", { method: \"GET\", body: \"x\" });\n")
}
