package ttsc_test

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestCLIReportsDiagnosticsWithoutEmit verifies API diagnostics remain
// machine-readable when the project has a semantic error.
//
// 1. Create a strict project with a known type mismatch.
// 2. Execute `api-transform`, which should still serialize a JSON result.
// 3. Assert the exit code fails while diagnostics stay in stdout for callers.
func TestCLIReportsDiagnosticsWithoutEmit(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: one strict type error is enough to exercise the diagnostic
	// path while keeping the expected JSON result small and deterministic.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `const value: string = 123;
`)

	// Diagnostic assertion: go-run wrapping is unwrapped by the helper so this
	// checks the native ttsc exit code, not the Go tool's generic status.
	code, out, errOut := runNativeCommand(t, "api-transform", "--cwd", root)
	if code != 2 {
		t.Fatalf("api-transform should fail with diagnostics: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	var transformed apiTransformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
		t.Fatalf("diagnostic JSON decode failed: %v\nstdout=%s\nstderr=%s", err, out, errOut)
	}
	if len(transformed.Diagnostics) == 0 || transformed.Diagnostics[0].Category != "error" {
		t.Fatalf("expected serialized error diagnostics: %#v", transformed.Diagnostics)
	}
}
