package linthost

import "testing"

// TestRuleCorpusUnicornPreferImportMetaProperties verifies the rule reports
// the legacy `fileURLToPath(import.meta.url)` pattern.
//
// The rule's single branch matches a `fileURLToPath` call whose argument is
// `import.meta.url`; this is the canonical pre-`import.meta.dirname` recipe
// and the only shape the rule rewrites, so the fixture pins it directly.
//
// 1. Enable unicorn/prefer-import-meta-properties via an expect annotation.
// 2. Call `fileURLToPath(import.meta.url)` on a declared shim of the helper.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies fileURLToPath converts import.meta.url only to retrieve a filename; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-import-meta-properties annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; import.meta.filename exposes that filename directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferImportMetaProperties is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferImportMetaProperties(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-import-meta-properties.ts", "declare function fileURLToPath(url: string): string;\n// expect: unicorn/prefer-import-meta-properties error\nconst filename = fileURLToPath(import.meta.url);\nvoid filename;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-import-meta-properties", "const filename = import.meta.filename;\n")
}
