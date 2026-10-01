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
//
// @evidence contracts/testing.md#behavioral-verification matchAnyPattern accepts authored .next TS/TSX nested output and next-env.d.ts while rejecting .next-cache and ordinary source.
// @evidence contracts/testing.md#independent-expectations Literal dot-directory segments must not become prefix matching, and basename patterns match their named file; six independently authored Boolean rows establish exact expected scope.
// @evidence contracts/testing.md#distinguishing-cases Owns multiple descendant depths and source extensions, root basename, near-prefix directory and ordinary-file negative.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Six authored generated/basename/near-miss paths call matchAnyPattern directly in the shared Go process; predicate results exercise glob semantics without an installed Next.js consumer or native build.
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
