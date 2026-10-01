package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesSafeCallsInCompositesHonorStructuredSpecifiers proves
// nested matching retains file, package, and TypeScript-lib source boundaries.
// @evidence contracts/testing.md#behavioral-verification Structured known-safe call identities must survive composite-expression traversal.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 7, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases File, package and lib-resolve calls stay exempt inside logical/conditional expressions; unlisted native reject reports. The synthetic package manifest feeds actual resolver behavior, not a file-existence check.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesSafeCallsInCompositesHonorStructuredSpecifiers invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestNoFloatingPromisesSafeCallsInCompositesHonorStructuredSpecifiers(t *testing.T) {
  source := `import { localSafeCall } from "./safe";
import { packageSafeCall } from "safe-package";
declare const condition: boolean;
condition && localSafeCall();
condition ? packageSafeCall() : Promise.resolve();
// expect only the unlisted native call
condition && Promise.reject(new Error("unsafe"));
`
  extras := map[string]string{
    "src/safe.ts": `export declare function localSafeCall(): Promise<void>;
`,
    "node_modules/safe-package/package.json": `{"name":"safe-package","types":"index.d.ts"}`,
    "node_modules/safe-package/index.d.ts": `export declare function packageSafeCall(): Promise<void>;
`,
  }
  code, stdout, stderr := runNoFloatingPromisesProjectCase(t, source, map[string]any{
    "allowForKnownSafeCalls": []any{
      map[string]any{"from": "file", "name": "localSafeCall", "path": "src/safe.ts"},
      map[string]any{"from": "package", "name": "packageSafeCall", "package": "safe-package"},
      map[string]any{"from": "lib", "name": "resolve"},
    },
  }, extras)
  if code != 2 || stdout != "" || strings.Count(stderr, "[typescript/no-floating-promises]") != 1 ||
    !diagnosticOutputContains(stderr, "main.ts:7:") {
    t.Fatalf("structured nested safe-call mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 7)
}
