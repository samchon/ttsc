package ttsc_test

import (
  "bytes"
  "errors"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// failingReader returns an error on the first read, simulating a broken stdin
// pipe to the resident host.
type failingReader struct{}

func (failingReader) Read([]byte) (int, error) {
  return 0, errors.New("simulated stdin failure")
}

// TestUtilityServeExitsWhenProjectDoesNotCompile verifies the resident host
// fails its startup compile loudly: a project that does not type-check makes
// RunServe exit non-zero before serving any request, rather than coming up and
// answering with empty transforms.
//
// This is the startup half of the diagnostics contract: the
// JS client surfaces the non-zero exit (and the stderr diagnostics) as a
// rejected transformFile, so the build error reaches the caller instead of
// silently producing nothing.
//
// 1. Build a single-file project whose source has a type error.
// 2. Run RunServe with one request.
// 3. Assert it exits non-zero and wrote no reply.
//
// @evidence contracts/testing.md#behavioral-verification RunServe over a project with a type error exits nonzero before answering any request and writes no reply.
// @evidence contracts/testing.md#independent-expectations Nonzero status and an empty reply stream are the contract for a startup compile failure.
// @evidence contracts/testing.md#distinguishing-cases A request is supplied so that serving would be observable; its absence from the output distinguishes loud failure from empty transforms.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeExitsWhenProjectDoesNotCompile is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityServeExitsWhenProjectDoesNotCompile(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = "not a number";
`)

  requests := serveRequestLine(t, filepath.Join(root, "index.ts")) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code == 0 {
    t.Fatalf("expected a non-zero exit for a project that does not compile; output=%q", out.String())
  }
  if reply := strings.TrimSpace(out.String()); reply != "" {
    t.Fatalf("expected no reply on a failed startup compile, got %q", reply)
  }
}

// TestUtilityServeExitsOnInputReadError verifies the resident host exits
// non-zero when reading its request stream fails with a non-EOF error, rather
// than treating the failure as a clean end of input.
//
// @evidence contracts/testing.md#behavioral-verification RunServe exits nonzero when its request stream fails with a non-EOF read error instead of treating it as a clean end of input.
// @evidence contracts/testing.md#independent-expectations The failing reader returns a deliberate error, and the nonzero status is the contract.
// @evidence contracts/testing.md#distinguishing-cases A clean EOF (exit zero) is the neighbor exercised by the other serve tests.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeExitsOnInputReadError is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityServeExitsOnInputReadError(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  var out bytes.Buffer
  code := utility.RunServe(failingReader{}, &out, []string{"--cwd", root})
  if code == 0 {
    t.Fatalf("expected a non-zero exit on a stdin read error; output=%q", out.String())
  }
}
