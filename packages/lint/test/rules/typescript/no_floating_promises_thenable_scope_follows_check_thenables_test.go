package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesThenableScopeFollowsCheckThenables verifies
// `checkThenables` selects which types the rule examines, the way the option it
// borrows its name from does.
//
// The option used to decide whether a thenable receiver could be credited as
// handled, so turning it on made the rule report less and leaving it off made a
// handled thenable chain report — the opposite of
// `@typescript-eslint/no-floating-promises`, whose documentation defines it as
// "whether to check all Thenables, not just the built-in Promise type". A
// configuration copied from a typescript-eslint project produced inverted
// results with no error to show for it.
//
//  1. Discard a handled and an unhandled chain on a custom thenable, and the
//     same two on a native Promise.
//  2. Run with no options, then with `checkThenables` on.
//  3. Assert the thenable chains are out of scope by default and in scope when
//     the option is on, while the native Promise verdicts never move.
func TestNoFloatingPromisesThenableScopeFollowsCheckThenables(t *testing.T) {
  source := `declare class Thenable<T> {
  then<R1 = T, R2 = never>(ok?: ((v: T) => R1) | null, err?: ((e: unknown) => R2) | null): Promise<R1 | R2>;
  catch<R = never>(err?: ((e: unknown) => R) | null): Promise<T | R>;
}
declare const thenable: Thenable<void>;
declare const promise: Promise<void>;
thenable.catch(() => undefined);
thenable.then(() => undefined);
promise.catch(() => undefined);
promise.then(() => undefined);
`

  code, stdout, stderr := runNoFloatingPromisesCase(t, source, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("default run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 1 {
    t.Fatalf("default expected 1 finding, got %d:\n%s", got, stderr)
  }
  // Only the native chain that never receives a rejection handler survives.
  if !diagnosticOutputContains(stderr, "main.ts:10:") {
    t.Fatalf("default lost the unhandled native chain:\n%s", stderr)
  }
  for _, line := range []string{"main.ts:7:", "main.ts:8:"} {
    if diagnosticOutputContains(stderr, line) {
      t.Fatalf("thenable reported at %s under the default checkThenables:\n%s", line, stderr)
    }
  }
  if diagnosticOutputContains(stderr, "main.ts:9:") {
    t.Fatalf("handled native chain reported:\n%s", stderr)
  }

  code, stdout, stderr = runNoFloatingPromisesCase(t, source, map[string]any{
    "checkThenables": true,
  })
  if code != 2 || stdout != "" {
    t.Fatalf("checkThenables run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 2 {
    t.Fatalf("checkThenables expected 2 findings, got %d:\n%s", got, stderr)
  }
  // Turning the option on brings the thenable into scope, so its unhandled
  // chain now reports while its handled one still does not.
  for _, line := range []string{"main.ts:8:", "main.ts:10:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("checkThenables missing the unhandled chain at %s:\n%s", line, stderr)
    }
  }
  for _, line := range []string{"main.ts:7:", "main.ts:9:"} {
    if diagnosticOutputContains(stderr, line) {
      t.Fatalf("checkThenables reported a handled chain at %s:\n%s", line, stderr)
    }
  }
}
