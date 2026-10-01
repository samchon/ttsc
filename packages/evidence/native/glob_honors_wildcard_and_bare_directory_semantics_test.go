package evidence

import (
  "testing"
)

/**
 * Verifies glob matching: the three documented wildcards retain their segment
 * boundaries across nested paths.
 *
 * The superseded matcher made a bare directory recursive, contradicting every
 * public files property. These positive and negative twins make the documented
 * path language the executable oracle.
 *
 *  1. Compile `*`, `**`, and `?` patterns.
 *  2. Match adjacent root, nested, and suffix-length cases.
 *  3. Assert only the documented paths are selected.
 * @evidence contracts/testing.md#behavioral-verification newGlobSet is compiled for each of nine (pattern, path) rows and globs.matches must equal the authored boolean: `docs/*.md` matches `docs/spec.md` but not `docs/nested/spec.md`, `docs/**\/*.md` matches both, `scripts/check-?.ts` matches `check-a.ts` but not `check-ab.ts`, and the bare `docs` and `docs/` do not match `docs/spec.md` while `docs/**` does.
 * @evidence contracts/testing.md#independent-expectations The expected booleans are authored from the documented path language: `*` and `?` stay within a segment, `**` crosses segments, and a bare directory is not recursive; each row is a literal, not computed by the matcher.
 * @evidence contracts/testing.md#distinguishing-cases Positive and negative twins for each wildcard (root versus nested, one character versus two) and for the bare-directory forms against `docs/**`; the rows run in a plain loop with Errorf, not named subtests.
 * @evidence contracts/testing.md#execution-ownership TestGlobHonorsWildcardAndBareDirectorySemantics is a Go unit entry in the native test process; it calls newGlobSet and matches on in-memory strings with no filesystem, consumer install or product host.
 */
func TestGlobHonorsWildcardAndBareDirectorySemantics(t *testing.T) {
  cases := []struct {
    pattern string
    path    string
    want    bool
  }{
    {"docs/*.md", "docs/spec.md", true},
    {"docs/*.md", "docs/nested/spec.md", false},
    {"docs/**/*.md", "docs/spec.md", true},
    {"docs/**/*.md", "docs/nested/spec.md", true},
    {"scripts/check-?.ts", "scripts/check-a.ts", true},
    {"scripts/check-?.ts", "scripts/check-ab.ts", false},
    {"docs", "docs/spec.md", false},
    {"docs/", "docs/spec.md", false},
    {"docs/**", "docs/spec.md", true},
  }
  for _, entry := range cases {
    globs, err := newGlobSet([]string{entry.pattern})
    if err != nil {
      t.Fatal(err)
    }
    if got := globs.matches(entry.path); got != entry.want {
      t.Errorf("%q matching %q = %v, want %v", entry.pattern, entry.path, got, entry.want)
    }
  }
}
