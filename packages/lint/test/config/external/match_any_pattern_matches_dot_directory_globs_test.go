package linthost

import "testing"

// TestMatchAnyPatternMatchesDotDirectoryGlobs verifies that ignore globs
// rooted in a dot-directory (`.next/**/*.ts`) and bare-basename globs
// (`next-env.d.ts`) match files under those paths.
//
// Next.js projects ignore their generated output with exactly these two
// pattern shapes. The segment matcher must treat a leading `.next` segment as
// a literal directory name (no special dot-file semantics) and must prepend
// `**/` to a slash-less pattern so `next-env.d.ts` matches at the base
// directory root. A near-miss sibling (`.next-cache/`) pins the boundary: the
// dot-directory segment is a whole-segment literal, not a prefix.
//
//  1. Define the two Next.js-shaped ignore globs.
//  2. Match generated files under `.next/`, the root `next-env.d.ts`, a
//     `.next-cache/` near-miss, and an ordinary source file.
//  3. Assert only the genuinely ignored files match.
func TestMatchAnyPatternMatchesDotDirectoryGlobs(t *testing.T) {
  patterns := []string{".next/**/*.ts", ".next/**/*.tsx", "next-env.d.ts"}
  cases := []struct {
    file string
    want bool
  }{
    {"/project/.next/types/validator.ts", true},
    {"/project/.next/types/app/page.tsx", true},
    {"/project/.next/dev/types/routes.d.ts", true},
    {"/project/next-env.d.ts", true},
    {"/project/.next-cache/types/validator.ts", false},
    {"/project/src/main.ts", false},
  }
  for _, tc := range cases {
    got := matchAnyPattern("/project", patterns, tc.file)
    if got != tc.want {
      t.Errorf("matchAnyPattern(%q): want %v, got %v", tc.file, tc.want, got)
    }
  }
}
