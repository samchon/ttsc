package ttsc_test

import (
  "slices"
  "testing"
)

// TestUtilityFilterHostArgsKeepsUtilityFlagsAndDropsHostOnlyFlags verifies
// basic host argument filtering.
//
// The utility sidecar accepts a narrower command surface than the JS wrapper.
// This unit check keeps wrapper-only flags from leaking into Go flag parsing
// while preserving utility flags and positional source files before `--`.
//
// This scenario remains bound to the filtering helper because the behavior is
// about the exact argument list sent to Go's flag package. A broader command
// fixture would hide which flags were discarded before parsing.
//
// 1. Pass utility flags, wrapper-only flags, a positional source, and `--`.
// 2. Filter the host arguments through the utility helper.
// 3. Assert only the utility-visible arguments before `--` remain.
//
// @evidence contracts/testing.md#behavioral-verification utilityFilterHostArgs drops wrapper-only flags and everything after '--' while keeping utility flags and the positional source file.
// @evidence contracts/testing.md#independent-expectations The expected list is the authored subset of the input, written literally.
// @evidence contracts/testing.md#distinguishing-cases Wrapper-only flags (--cache-dir, --binary=...) and the post-separator tokens must disappear while the utility flags and the positional source stay.
// @evidence contracts/testing.md#execution-ownership TestUtilityFilterHostArgsKeepsUtilityFlagsAndDropsHostOnlyFlags is a Go unit test in the test/utility process: it calls the argument filter directly with literal arguments and starts no project or process.
func TestUtilityFilterHostArgsKeepsUtilityFlagsAndDropsHostOnlyFlags(t *testing.T) {
  got := utilityFilterHostArgs([]string{
    "--cwd", "/workspace/project",
    "--cache-dir", ".ttsc",
    "--emit",
    "--binary=/tmp/tsgo",
    "--plugins-json", "[]",
    "src/main.ts",
    "--",
    "--cwd", "ignored",
  })
  want := []string{
    "--cwd", "/workspace/project",
    "--emit",
    "--plugins-json", "[]",
    "src/main.ts",
  }
  if !slices.Equal(got, want) {
    t.Fatalf("filtered args mismatch:\nwant: %#v\n got: %#v", want, got)
  }
}
