package ttsc_test

import (
  "slices"
  "testing"
)

// TestUtilityFilterHostArgsKeepsTsgoArgsFlag verifies the forwarded-flag
// payload survives host-argument filtering.
//
// The `ttsc` launcher hands the transform-plugin host its forwarded tsgo flags
// as one `--tsgo-args=<json>` token. filterHostArgs strips flags the Go flag
// set does not declare, so `--tsgo-args` must be in its allow-list — otherwise
// the payload is dropped before `parseHostOptions` ever decodes it and a flag
// like `ttsc --strict` would be silently lost on a transform-plugin build. The
// JSON value carries quotes, commas, and embedded `--`, so this also pins that
// the whole token is kept intact rather than split.
//
// 1. Filter an argument list containing the inline `--tsgo-args=<json>` token.
// 2. Assert the token survives verbatim alongside the other utility flags.
//
// @evidence contracts/testing.md#behavioral-verification utilityFilterHostArgs keeps the inline --tsgo-args=<json> token whole, including its quotes, commas and embedded '--', next to the other utility flags.
// @evidence contracts/testing.md#independent-expectations The expected slice is the authored argument list itself, so a dropped or split token fails the comparison.
// @evidence contracts/testing.md#distinguishing-cases The JSON payload contains '--' and commas, which a naive splitter would cut; the neighboring utility flags confirm they are untouched.
// @evidence contracts/testing.md#execution-ownership TestUtilityFilterHostArgsKeepsTsgoArgsFlag is a Go unit test in the test/utility process: it calls the argument filter directly with literal arguments and starts no project or process.
func TestUtilityFilterHostArgsKeepsTsgoArgsFlag(t *testing.T) {
  got := utilityFilterHostArgs([]string{
    "--cwd", "/workspace/project",
    `--tsgo-args=["--strict","--target","es2020"]`,
    "--plugins-json", "[]",
  })
  want := []string{
    "--cwd", "/workspace/project",
    `--tsgo-args=["--strict","--target","es2020"]`,
    "--plugins-json", "[]",
  }
  if !slices.Equal(got, want) {
    t.Fatalf("filtered args mismatch:\nwant: %#v\n got: %#v", want, got)
  }
}
