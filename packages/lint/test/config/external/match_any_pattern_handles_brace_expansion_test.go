package linthost

import "testing"

// TestMatchAnyPatternHandlesBraceExpansion verifies brace alternatives like
// `{a,b,c}` are expanded before being matched against a file path.
//
// Go's `filepath.Match` does not honor brace expansion natively, so a
// user-authored glob such as `src/driver/mongodb/{typings.ts,bson.typings.ts}`
// previously fell through every branch and matched nothing. The typeorm
// fixture wrote exactly that glob in its lint config's `ignores` list and
// observed the matching files getting formatted because the pattern never
// matched. This case pins the brace-expansion helper that splits the group
// into the equivalent flat alternatives before matching.
//
//  1. Define one ignores glob that uses a brace group spanning two filenames.
//  2. Match each listed alternative, an unlisted sibling, and a path outside
//     the prefix against the same pattern.
//  3. Assert each listed alternative matches, and the unlisted sibling plus
//     the outside path do not.
func TestMatchAnyPatternHandlesBraceExpansion(t *testing.T) {
  patterns := []string{"src/driver/mongodb/{typings.ts,bson.typings.ts}"}
  cases := []struct {
    file string
    want bool
  }{
    {"/project/src/driver/mongodb/typings.ts", true},
    {"/project/src/driver/mongodb/bson.typings.ts", true},
    {"/project/src/driver/mongodb/other.ts", false},
    {"/project/src/main.ts", false},
  }
  for _, tc := range cases {
    got := matchAnyPattern("/project", patterns, tc.file)
    if got != tc.want {
      t.Errorf("matchAnyPattern(%q): want %v, got %v", tc.file, tc.want, got)
    }
  }
}
