package ttsc_test

import "testing"

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
	if !sameStrings(got, want) {
		t.Fatalf("filtered args mismatch:\nwant: %#v\n got: %#v", want, got)
	}
}

func sameStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}
