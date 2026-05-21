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
