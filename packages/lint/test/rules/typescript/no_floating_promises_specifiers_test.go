package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoFloatingPromisesStructuredSpecifiers verifies file, package, and lib
// allowlists match both the declared name and the configured source boundary.
//
//  1. Materialize local and package declarations plus built-in Promise types.
//  2. Run matching and deliberately wrong-source configurations.
//  3. Assert only declarations outside each configured boundary report.
func TestNoFloatingPromisesStructuredSpecifiers(t *testing.T) {
  source := `import { LocalSafePromise, localSafeCall } from "./safe";
import { PackageSafePromise, packageSafeCall } from "safe-package";
declare const localSafePromise: LocalSafePromise<void>;
declare const packageSafePromise: PackageSafePromise<void>;
declare const ordinaryPromise: Promise<void>;
localSafeCall();
localSafePromise;
packageSafeCall();
packageSafePromise;
ordinaryPromise;
`
  extras := map[string]string{
    "src/safe.ts": `export declare class LocalSafePromise<T> extends Promise<T> {}
export declare function localSafeCall(): Promise<void>;
`,
    "node_modules/safe-package/package.json": `{"name":"safe-package","types":"index.d.ts"}`,
    "node_modules/safe-package/index.d.ts": `export declare class PackageSafePromise<T> extends Promise<T> {}
export declare function packageSafeCall(): Promise<void>;
`,
  }
  matching := map[string]any{
    "allowForKnownSafeCalls": []any{
      map[string]any{"from": "file", "name": "localSafeCall", "path": "src/safe.ts"},
      map[string]any{"from": "package", "name": "packageSafeCall", "package": "safe-package"},
    },
    "allowForKnownSafePromises": []any{
      map[string]any{"from": "file", "name": "LocalSafePromise", "path": "src/safe.ts"},
      map[string]any{"from": "package", "name": "PackageSafePromise", "package": "safe-package"},
    },
  }
  code, stdout, stderr := runNoFloatingPromisesProjectCase(t, source, matching, extras)
  if code != 2 || stdout != "" || strings.Count(stderr, "[typescript/no-floating-promises]") != 1 || !diagnosticOutputContains(stderr, "main.ts:10:") {
    t.Fatalf("matching specifier run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  wrongSource := map[string]any{
    "allowForKnownSafeCalls": []any{
      map[string]any{"from": "file", "name": "localSafeCall", "path": "src/other.ts"},
      map[string]any{"from": "package", "name": "packageSafeCall", "package": "other-package"},
    },
    "allowForKnownSafePromises": []any{
      map[string]any{"from": "file", "name": "LocalSafePromise", "path": "src/other.ts"},
      map[string]any{"from": "package", "name": "PackageSafePromise", "package": "other-package"},
    },
  }
  code, stdout, stderr = runNoFloatingPromisesProjectCase(t, source, wrongSource, extras)
  if code != 2 || stdout != "" || strings.Count(stderr, "[typescript/no-floating-promises]") != 5 {
    t.Fatalf("wrong-source specifier run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  for _, line := range []string{"main.ts:6:", "main.ts:7:", "main.ts:8:", "main.ts:9:", "main.ts:10:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing wrong-source finding at %s\n%s", line, stderr)
    }
  }

  code, stdout, stderr = runNoFloatingPromisesProjectCase(t, `class SafePromise<T> extends Promise<T> {}
declare const localSafe: SafePromise<void>;
declare const builtIn: Promise<void>;
builtIn;
localSafe;
`, map[string]any{
    "allowForKnownSafePromises": []any{
      map[string]any{"from": "lib", "name": []any{"Promise", "SafePromise"}},
    },
  }, nil)
  if code != 2 || stdout != "" || strings.Count(stderr, "[typescript/no-floating-promises]") != 1 || !diagnosticOutputContains(stderr, "main.ts:5:") {
    t.Fatalf("lib specifier run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  _, _, findings := runRuleFindingsSnapshot(
    t,
    "typescript/no-floating-promises",
    `class DirectSafePromise<T> extends Promise<T> {}
declare const directSafe: DirectSafePromise<void>;
directSafe;
`,
    json.RawMessage(`{"allowForKnownSafePromises":[{"from":"file","name":"DirectSafePromise","path":"src/main.ts"}]}`),
  )
  if len(findings) != 0 {
    t.Fatalf("direct Engine.Run current-directory mismatch: %+v", findings)
  }
}
