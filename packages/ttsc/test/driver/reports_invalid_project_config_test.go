package ttsc_test

import (
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverReportsInvalidProjectConfig verifies tsconfig diagnostics stay
// observable through the public driver facade.
//
//  1. Create a project with an invalid compiler option.
//  2. Load the project through `driver.LoadProgram`.
//  3. Assert that config diagnostics are returned without a partially-open
//     program leaking to the caller.
func TestDriverReportsInvalidProjectConfig(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the invalid enum value is a tsconfig-level failure, so the
	// driver should return diagnostics before any Program is opened.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "not-a-module-kind"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

	// Diagnostic assertion: config errors are returned as structured driver
	// diagnostics while the program value stays nil.
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if prog != nil {
		t.Fatalf("invalid config should not return a program: %#v", prog)
	}
	if len(diags) == 0 {
		t.Fatal("invalid config should return diagnostics")
	}
}
