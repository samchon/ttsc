package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsGroupsKeepGitignoreAnchorsGlobstarsAndUnicode verifies Grouped pattern matching preserves root anchors, ordinary-star segment boundaries, trailing nonempty components, Unicode negation and invalid-range behavior.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Grouped pattern matching preserves root anchors, ordinary-star segment boundaries, trailing nonempty components, Unicode negation and invalid-range behavior.
// @evidence contracts/testing.md#independent-expectations Each authored target follows gitignore pattern meaning: /root excludes nested/root, foo**bar cannot cross slash, trailing stars require a child, the Unicode public path is negated, and [z-a] cannot match.
// @evidence contracts/testing.md#distinguishing-cases Separate calls own anchor/segment/trailing-star/globstar/Unicode cases and an invalid reversed range; all literals and target lists survive splitting.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsGroupsKeepGitignoreAnchorsGlobstarsAndUnicode(t *testing.T) {
  anchoredSource := `import "root";
import "nested/root";
`
  anchored := runNoRestrictedImports(
    t,
    anchoredSource,
    json.RawMessage(`{"patterns":[{"group":["/root"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, anchored, `"root"`)

  ordinaryStarsSource := `import "fooxbar";
import "foo/deep/bar";
`
  ordinaryStars := runNoRestrictedImports(
    t,
    ordinaryStarsSource,
    json.RawMessage(`{"patterns":[{"group":["foo**bar"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, ordinaryStars, `"fooxbar"`)

  trailingSource := `import "foo/";
import "foo/value";
`
  trailingStar := runNoRestrictedImports(
    t,
    trailingSource,
    json.RawMessage(`{"patterns":[{"group":["foo/*"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, trailingStar, `"foo/value"`)
  trailingGlobstar := runNoRestrictedImports(
    t,
    trailingSource,
    json.RawMessage(`{"patterns":[{"group":["foo/**"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, trailingGlobstar, `"foo/value"`)

  unicodeSource := `import "패키지/내부";
import "패키지/공개";
`
  unicodeGroup := runNoRestrictedImports(
    t,
    unicodeSource,
    json.RawMessage(`{"patterns":[{"group":["패키지/*","!패키지/공개"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, unicodeGroup, `"패키지/내부"`)

  invalidRange := runNoRestrictedImports(
    t,
    `import "range-target";`,
    json.RawMessage(`{"patterns":[{"group":["[z-a]"]}]}`),
  )
  if len(invalidRange) != 0 {
    t.Fatalf("an unusable gitignore range must not reject configuration or match imports: %+v", invalidRange)
  }
}
