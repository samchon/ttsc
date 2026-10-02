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
// Owning-package units cover all 21 command scenarios directly. This boundary
// retains the main function's os.Args/run/os.Exit wiring and the process cwd
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
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go Test owns one actual child invocation; 21 same-named owning-package direct units retain all original 28 argv dispatches and portable compiler/JSON/flag assertions.
// @evidence contracts/e2e.md#necessary-boundary Direct run calls cannot establish main's os.Args and os.Exit or cmd.Dir to os.Getwd across an OS child. One success process observes that wiring through an actual project and emitted file; help/version/aliases remain direct units.
// @evidence contracts/e2e.md#shared-execution The existing sync.Once compiler artifact serves this success and the unknown-command failure. This success loads one Program; the failure loads none. Two child lifetimes are necessary to observe both zero and nonzero os.Exit statuses.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity This body owns its temporary project; the child completes before file/stream assertions and cleanup. TestMain releases the unchanged suite artifact after both consumers and count repetitions; mutable compiler input is not shared with direct units.
// @evidence contracts/e2e.md#preserved-coverage Direct units preserve the original 21 TestNames, fixtures, named aliases, literal argv, JSON/diagnostic/filesystem assertions and failure messages. This single success boundary additionally establishes implicit cwd, actual disk output and both quiet stream observations; Node and resident stdin boundaries remain with their owners.
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
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go Test owns one real child; direct owning-package tests retain both original unsupported labels and every original command scenario.
// @evidence contracts/e2e.md#necessary-boundary main calls os.Exit on run's returned status; a direct unit cannot establish the OS exit or actual stderr transport. This error case avoids a needless Program while covering nonzero process completion.
// @evidence contracts/e2e.md#shared-execution Both process tests use the unchanged once-built cmd/ttsc artifact. Each effectful argv execution has its own waited child; no per-case compiler build or previously cached command result is substituted.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity No project fixture is required for this rejected label. Invocation-local stdout/stderr buffers and synchronous cmd.Run isolate observed bytes; suite TestMain retains the producer through the final consumer and handles cleanup failure.
// @evidence contracts/e2e.md#preserved-coverage The original fly-to-mars status two, empty stdout and unknown-command assertion remain here and in the direct unit. The 21 direct units preserve the complete original argv/fixture/assertion population; this pair retains zero and nonzero OS completion.
func TestCLIProcessUnknownCommandFails(t *testing.T) {
  code, out, errOut := runNativeCommand(t, "fly-to-mars")
  if code != 2 || out != "" || !strings.Contains(errOut, "unknown command") || !strings.Contains(errOut, "fly-to-mars") || !strings.Contains(errOut, "--help") {
    t.Fatalf("unknown command transport: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
