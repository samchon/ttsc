package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsGroupsKeepGitignoreAnchorsGlobstarsAndUnicode verifies
// group patterns follow gitignore semantics for root anchors, double stars that
// are not path globstars, trailing stars, Unicode negation and unusable ranges.
//
// The Test runs six rule invocations, each with its own source and group:
// "/root", "foo**bar", "foo/*", "foo/**", ["패키지/*", "!패키지/공개"] and "[z-a]".
//
// 1. Run each group over its two small sources and compare the reported ranges.
// 2. Require the descending range "[z-a]" to yield no finding and no configuration error.
//
// @evidence contracts/testing.md#behavioral-verification "/root" reports only the root import and not "nested/root"; "foo**bar" reports "fooxbar" and not "foo/deep/bar"; "foo/*" and "foo/**" report "foo/value" and not "foo/"; the Unicode group reports the internal path and spares the negated public path; the unusable "[z-a]" range matches nothing.
// @evidence contracts/testing.md#independent-expectations Each literal expectation follows gitignore pattern meaning: a leading slash anchors to the root, a double star inside a name cannot cross a slash, a trailing star or globstar needs a child component, a later negation re-includes its path, and an unusable bracket range does not match. The target lists are authored literals.
// @evidence contracts/testing.md#distinguishing-cases Each invocation pairs a matching import with an adjacent import that must stay clean, and the invalid-range invocation guards against rejecting the configuration. Case-folding and message text are owned by sibling Tests.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for each invocation, which binds the rule at error severity (so a configuration error would fail the Test), parses the source in a temporary project and runs Engine.Run in the Go test process. assertNoRestrictedImportsTargets compares the literal ranges; the Test asserts no messages.
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
