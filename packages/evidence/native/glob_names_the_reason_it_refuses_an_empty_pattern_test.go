package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a pattern that reduces to nothing is refused with the reason that
 * is true of it.
 *
 * A leading `./` is stripped before the pattern is read, so `./` and `!./`
 * reduce to an empty string without ever having been a bare exclusion marker.
 * Blaming the marker for them sends the author looking for a `!` that is
 * either absent or followed by a glob.
 *
 *  1. Compile a lone `!`, which is a marker with no glob.
 *  2. Compile `./` and `!./`, which name no path at all.
 *  3. Compile an ordinary pattern and require it accepted.
 *
 * @evidence contracts/testing.md#behavioral-verification newGlobSet returns the exclusion-marker error for `!` and an error naming the pattern and saying it names no path for `./` and `!./`; `docs/**` compiles.
 * @evidence contracts/testing.md#independent-expectations The expected sentences follow from what each spelling is: only a bare `!` is a marker lacking a glob, while a `./` reduces to the project root itself, so the literal fragments are authored from the pattern grammar rather than read from the compiler.
 * @evidence contracts/testing.md#distinguishing-cases The three refused spellings split on whether a marker was written at all, and the ordinary pattern is the adjacent input that must stay accepted.
 * @evidence contracts/testing.md#execution-ownership TestGlobNamesTheReasonItRefusesAnEmptyPattern is a Go unit entry in the native test process; it calls newGlobSet on in-memory strings with no filesystem, consumer install or product host.
 */
func TestGlobNamesTheReasonItRefusesAnEmptyPattern(t *testing.T) {
  _, err := newGlobSet([]string{"!"})
  if err == nil || !strings.Contains(err.Error(), "exclusion marker '!' must be followed by a glob") {
    t.Fatalf("a lone marker must say it needs a glob, got %v", err)
  }
  for _, pattern := range []string{"./", "!./"} {
    _, err := newGlobSet([]string{pattern, "docs/**"})
    if err == nil ||
      !strings.Contains(err.Error(), "'"+pattern+"'") ||
      !strings.Contains(err.Error(), "names no path below the project root") ||
      strings.Contains(err.Error(), "exclusion marker") {
      t.Fatalf("%q must be refused as naming no path, got %v", pattern, err)
    }
  }
  if _, err := newGlobSet([]string{"docs/**"}); err != nil {
    t.Fatalf("an ordinary pattern was refused: %v", err)
  }
}
