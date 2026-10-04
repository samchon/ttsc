//go:build e2e

package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProcessCurrentDirectoryBuildSucceeds verifies the actual native
// process connects empty argv and its cwd to emitted JavaScript and status zero.
//
// The owning TestCLICommandOperationFamilies retains 21 named command cases.
// This boundary retains the main function's os.Args/run/os.Exit wiring and the process cwd
// used by os.Getwd, with a literal source and emitted-file oracle. It does not
// claim Node wrapper or resident JSON-stdin protocol coverage.
//
// 1. Materialize a CommonJS project with configured output and no cwd override.
// 2. Start the once-built native command in that project with empty argv.
// 3. Assert zero status, both quiet streams empty and emitted marker JavaScript.
//
// @evidence contracts/testing.md#behavioral-verification Empty argv in the actual fixture cwd produces bin/index.js containing exports.marker and 42, returns OS status zero, and leaves both quiet stdout and stderr empty.
// @evidence contracts/testing.md#independent-expectations Authored export marker = 42, configured bin/index.js, literal zero status and empty streams define the oracle; no expected byte fragment comes from the emitted result.
// @evidence contracts/testing.md#distinguishing-cases Successful compilation uses the implicit process cwd and empty argv; the separate unknown-command process covers nonzero exit and stderr routing.
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go Test owns one actual native child invocation using the suite's once-built artifact. The owning TestCLICommandOperationFamilies retains 21 named direct command cases; their authored selection and assertions do not certify actual process status or final survivor execution.
// @evidence contracts/e2e.md#necessary-boundary Actual main/os.Args/process cwd/os.Exit connect empty argv to compilation, emitted marker fragments, quiet streams and status zero. Direct dispatcher returns cannot certify this OS transport; Node wrapper and resident JSON-stdin are separate boundaries.
// @evidence contracts/e2e.md#shared-execution Suite sync.Once builds cmd/ttsc once, reused by this success process and the unknown-command process. Fresh process lifetime is necessary to observe cwd and OS exit; fixture project load is owned by this success input rather than borrowed from the direct command family.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns a fresh project and output path, with no cwd override; helpers preserve argv/cwd and separate captured streams and wait for Run before return. TestMain releases the shared binary directory after all cases with bounded Windows-denial retry. Product sources/toolchain/build flags must remain fixed; selected executable byte identity and actual reuse measurement remain unverified.
// @evidence contracts/e2e.md#preserved-coverage This process retains status zero, both empty quiet streams and authored exports.marker/42 output fragments. Portable dispatch, config, diagnostics and serialized output assertions remain under TestCLICommandOperationFamilies; this declaration does not independently certify every transferred case's runtime survival or complete emitted semantics.
func TestCLIProcessCurrentDirectoryBuildSucceeds(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin"},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const marker = 42;\n")
  code, out, errOut := runBuiltNativeCommandInDir(t, root)
  if code != 0 || out != "" || errOut != "" {
    t.Fatalf("implicit cwd build transport: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  javascript, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil { t.Fatalf("read emitted marker: %v", err) }
  if !strings.Contains(string(javascript), "exports.marker") || !strings.Contains(string(javascript), "42") {
    t.Fatalf("emitted marker missing: %q", javascript)
  }
}

// TestCLIProcessUnknownCommandFails verifies a native usage failure returns
// actual OS status two with stderr and no stdout result.
//
// The input is rejected before project loading, so no compiler Program is
// needed to distinguish main's nonzero exit and stream routing. Other command
// diagnostics and help/alias variations are owned by the direct units.
//
// 1. Invoke the once-built native command with literal fly-to-mars argv.
// 2. Wait for the child and capture its separate stdout and stderr streams.
// 3. Assert status two, empty stdout, the unknown label and help pointer.
//
// @evidence contracts/testing.md#behavioral-verification fly-to-mars produces OS exit two, empty stdout and stderr containing unknown command, fly-to-mars and --help.
// @evidence contracts/testing.md#independent-expectations Literal unsupported argv and usage status two distinguish transport failure from a serialized compiler response; expected fragments are not derived from captured output.
// @evidence contracts/testing.md#distinguishing-cases This nonzero process contrasts with the successful cwd/compiler process and retains the former fly-to-mars status/empty-stdout/error oracle, strengthened by its literal label and help pointer.
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go Test owns one native child using the shared suite artifact. TestCLICommandOperationFamilies supplies the named direct unknown-label cases; authored body existence is not actual runtime survival certification.
// @evidence contracts/e2e.md#necessary-boundary Actual native main/os.Exit and separate process streams must preserve literal usage status two, unknown label/help fragments and empty stdout. Direct dispatcher calls observe returned status rather than OS exit; the successful compiler process covers the distinct cwd/emit connection.
// @evidence contracts/e2e.md#shared-execution The same sync.Once-built cmd/ttsc artifact serves both transport cases. This fresh process is necessary to observe nonzero OS exit; its unknown argv rejects before project loading rather than preparing another compilation project.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Helpers select the shared suite artifact, retain literal argv and package cwd, capture both streams and wait for the original Run. No fixture files are mutated by this case; suite TestMain owns final binary-directory release. Source/toolchain/build inputs must remain fixed and actual selected image identity is not certified by argv text.
// @evidence contracts/e2e.md#preserved-coverage This process retains fly-to-mars status two/empty stdout/unknown-command text and adds literal label/help-pointer fragments. The direct family owns returned-dispatch outcomes for the unsupported labels and other command scenarios; exact survivor execution and measured sharing are still unverified.
func TestCLIProcessUnknownCommandFails(t *testing.T) {
  code, out, errOut := runNativeCommand(t, "fly-to-mars")
  if code != 2 || out != "" || !strings.Contains(errOut, "unknown command") || !strings.Contains(errOut, "fly-to-mars") || !strings.Contains(errOut, "--help") {
    t.Fatalf("unknown command transport: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
