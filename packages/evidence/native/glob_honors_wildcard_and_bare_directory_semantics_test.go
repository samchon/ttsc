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
 * @evidence contracts/testing.md#behavioral-verification newGlobSet, globs.matches is exercised with the scenario below; the assertions require only the documented paths are selected.
 * @evidence contracts/testing.md#independent-expectations The superseded matcher made a bare directory recursive, contradicting every public files property. These positive and negative twins make the documented path language the executable oracle.
 * @evidence contracts/testing.md#distinguishing-cases Compile `*`, `**`, and `?` patterns. Match adjacent root, nested, and suffix-length cases. Assert only the documented paths are selected.
 * @evidence contracts/testing.md#execution-ownership TestGlobHonorsWildcardAndBareDirectorySemantics is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
