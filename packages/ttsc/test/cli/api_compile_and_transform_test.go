package ttsc_test

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestCLIAPICompileAndTransform verifies the native JSON command adapters.
//
//  1. Materialize a compilable project with one TypeScript source file.
//  2. Run `api-compile` through the real `cmd/ttsc` front door.
//  3. Run `api-transform` and assert the source-text DTO uses project-relative
//     keys just like the JavaScript wrapper expects.
func TestCLIAPICompileAndTransform(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the CLI adapters must read a real project layout because
	// their key contract is project-relative output, not standalone file parsing.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const answer: number = 42;
`)

	// Compile assertion: api-compile returns emitted JavaScript as JSON and must
	// not write to the project outDir as a side effect.
	code, out, errOut := runNativeCommand(t, "api-compile", "--cwd", root)
	if code != 0 {
		t.Fatalf("api-compile failed: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	var compiled apiCompileResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &compiled); err != nil {
		t.Fatalf("api-compile JSON decode failed: %v\n%s", err, out)
	}
	if len(compiled.Diagnostics) != 0 {
		t.Fatalf("api-compile should not report diagnostics: %#v", compiled.Diagnostics)
	}
	if !strings.Contains(compiled.Output["bin/index.js"], "exports.answer") {
		t.Fatalf("api-compile output missing emitted JavaScript: %#v", compiled.Output)
	}

	// Transform assertion: api-transform returns parsed TypeScript source text
	// under the same relative key style used by the TypeScript wrapper.
	code, out, errOut = runNativeCommand(t, "api-transform", "--cwd", root)
	if code != 0 {
		t.Fatalf("api-transform failed: code=%d stdout=%q stderr=%q", code, out, errOut)
	}
	var transformed apiTransformResult
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
		t.Fatalf("api-transform JSON decode failed: %v\n%s", err, out)
	}
	if !strings.Contains(transformed.TypeScript["index.ts"], "answer: number") {
		t.Fatalf("api-transform source missing expected declaration: %#v", transformed.TypeScript)
	}
}
