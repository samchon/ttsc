package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseIgnorePatternsMatchSegments verifies `ignore`
// patterns are tested against every individual path segment, with negative
// twins for patterns that must not suppress the diagnostic.
//
// Upstream evaluates each configured pattern against each segment of the
// project-relative path, so a directory-only pattern like `^meta$` exempts the
// whole file while a partial match like `^meta$` on `metal` (or a pattern
// spanning a separator) must not.
//
// 1. Lint ignored/non-ignored filename pairs.
// 2. Assert suppression exactly when one segment matches one pattern.
//
// @evidence contracts/testing.md#behavioral-verification The rule evaluates configured ignore patterns against actual path segments, detecting ignored reports or overly broad suppression.
// @evidence contracts/testing.md#independent-expectations Authored regular expressions and literal path membership independently establish which segments are ignored.
// @evidence contracts/testing.md#distinguishing-cases Matching and nonmatching path-segment forms retain their opposite results; unrelated parts of a path cannot justify suppression.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseIgnorePatternsMatchSegments owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseIgnorePatternsMatchSegments(t *testing.T) {
  assertUnicornFilenameCaseValid(t, "src/meta/BadName.js", `{"case":"kebabCase","ignore":["^meta$"]}`)
  assertUnicornFilenameCaseMessage(
    t,
    "src/metal/BadName.js",
    `{"case":"kebabCase","ignore":["^meta$"]}`,
    "Filename is not in kebab case. Rename it to `bad-name.js`.",
  )
  // A pattern spanning a path separator can never match a single segment.
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/BadName.js",
    `{"case":"kebabCase","ignore":["src/foo"]}`,
    "Filename is not in kebab case. Rename it to `bad-name.js`.",
  )
  // The upstream suite's literal `/FOOBAR\.js/` STRING pattern (not a RegExp
  // literal) compiles with the slashes as plain characters and matches
  // nothing here.
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/barBaz.js",
    `{"case":"kebabCase","ignore":["/FOOBAR\\.js/"]}`,
    "Filename is not in kebab case. Rename it to `bar-baz.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/barBaz.js",
    `{"case":"kebabCase","ignore":["FOOBAR\\.js"]}`,
    "Filename is not in kebab case. Rename it to `bar-baz.js`.",
  )
  assertUnicornFilenameCaseMessage(
    t,
    "src/foo/fooBar.js",
    `{"case":"kebabCase","ignore":["FOOBAR\\.js","foobar\\.js"]}`,
    "Filename is not in kebab case. Rename it to `foo-bar.js`.",
  )
  for _, ignore := range []string{
    `["FOOBAR\\.js"]`,
    `["BaRbAz\\.js"]`,
    `["^foo"]`,
    `["^foo","^bar"]`,
  } {
    assertUnicornFilenameCaseMessage(
      t,
      "src/qux/FooBar.js",
      `{"cases":{"camelCase":true,"snakeCase":true},"ignore":`+ignore+`}`,
      "Filename is not in camel case or snake case. Rename it to `fooBar.js` or `foo_bar.js`.",
    )
  }
  // Ignore patterns also match middle extension segments of the basename.
  assertUnicornFilenameCaseValid(
    t,
    "src/foo/FooBar.something.js",
    `{"case":"kebabCase","ignore":["\\.(?:web|android|ios|something)\\.js$"]}`,
  )
}
