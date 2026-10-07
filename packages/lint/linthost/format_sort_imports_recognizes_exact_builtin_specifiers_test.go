package linthost

import (
  "strconv"
  "testing"
)

// TestFormatSortImportsRecognizesExactBuiltinSpecifiers verifies that Node's
// built-in group recognizes actual module identifiers, including prefix-only
// modules, while leaving unsupported subpaths and bare prefix-only names in
// the third-party group. Every case reverses the independently expected order
// so the real format engine must edit it without changing bindings or uses.
//
// @evidence contracts/testing.md#behavioral-verification The configured format/sort-imports engine applies a fix and compares the complete rewritten file for each actual built-in or adjacent third-party spelling. The group difference must reorder both import declarations while preserving their bindings and body.
// @evidence contracts/testing.md#independent-expectations Literal classifications follow Node v24.18.0 module.isBuiltin and the documented mandatory node: prefix for sea, sqlite, test and test/reporters. Neither the production module map nor its string splitting generates the expected classifications.
// @evidence contracts/testing.md#distinguishing-cases Bare and prefixed ordinary modules, every supported public subpath, internal modules, four prefix-only names and their bare twins, unknown subpaths, unknown prefixed names, case changes and relative lookalikes distinguish exact module membership from prefix or basename guesses.
// @evidence contracts/testing.md#execution-ownership This Go unit owns each named literal specifier, classification and full-file oracle. assertFixSnapshotWithOptions executes the owning syntax engine and fix applier in-process with a fixture filesystem, without installing a consumer, building a native artifact or starting a product host.
func TestFormatSortImportsRecognizesExactBuiltinSpecifiers(t *testing.T) {
  cases := []struct {
    specifier string
    builtin   bool
  }{
    {"fs", true}, {"node:fs", true},
    {"assert/strict", true}, {"dns/promises", true},
    {"fs/promises", true}, {"inspector/promises", true},
    {"path/posix", true}, {"path/win32", true},
    {"readline/promises", true}, {"stream/consumers", true},
    {"stream/promises", true}, {"stream/web", true},
    {"timers/promises", true}, {"util/types", true},
    {"node:fs/promises", true}, {"_http_agent", true},
    {"node:_stream_duplex", true},
    {"node:sea", true}, {"node:sqlite", true},
    {"node:test", true}, {"node:test/reporters", true},
    {"sea", false}, {"sqlite", false},
    {"test", false}, {"test/reporters", false},
    {"fs/not-a-real-builtin", false},
    {"node:fs/not-a-real-builtin", false},
    {"node:test/not-a-real-builtin", false},
    {"node:not-a-real-builtin", false},
    {"FS", false}, {"node:FS", false},
    {"./fs", false}, {"../fs", false},
  }
  for _, test := range cases {
    t.Run(test.specifier, func(t *testing.T) {
      candidate := "import candidate from " + strconv.Quote(test.specifier) + ";\n"
      thirdParty := "import external from \"@a/third-party\";\n"
      body := "JSON.stringify({ candidate, external });\n"
      source, expected := candidate+thirdParty+body, thirdParty+candidate+body
      if test.builtin {
        source, expected = thirdParty+candidate+body, candidate+thirdParty+body
      }
      assertFixSnapshotWithOptions(t, "format/sort-imports", source,
        `{"unsafeSortRuntimeImports":true}`, expected)
    })
  }
}
