package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesTypeAndExpressionShapes locks the checker-backed
// Promise identity and recursive expression paths required by issue #412.
func TestNoFloatingPromisesTypeAndExpressionShapes(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `type PromiseAlias<T> = Promise<T>;
class DerivedPromise<T> extends Promise<T> {}
declare const aliasPromise: PromiseAlias<void>;
declare const derivedPromise: DerivedPromise<void>;
declare const intersectedPromise: Promise<void> & { readonly tag: true };
declare const unionPromise: Promise<void> | undefined;
declare const optionalFactory: (() => Promise<void>) | undefined;
declare const flag: boolean;
aliasPromise;
derivedPromise;
intersectedPromise;
unionPromise;
optionalFactory?.();
flag ? Promise.resolve() : undefined;
flag && Promise.resolve();
(Promise.resolve(), undefined);
[Promise.resolve(), 1];
[1, 2, 3];
void Promise.resolve();
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("type-shape run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  expectedLines := []string{
    "main.ts:9:",
    "main.ts:10:",
    "main.ts:11:",
    "main.ts:12:",
    "main.ts:13:",
    "main.ts:14:",
    "main.ts:15:",
    "main.ts:16:",
    "main.ts:17:",
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != len(expectedLines) {
    t.Fatalf("expected %d shape findings, got %d:\n%s", len(expectedLines), got, stderr)
  }
  for _, line := range expectedLines {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing shape finding at %s\n%s", line, stderr)
    }
  }
}
