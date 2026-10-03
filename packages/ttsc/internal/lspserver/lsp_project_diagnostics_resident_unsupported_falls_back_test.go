package lspserver

import (
  "bytes"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestLSPProjectDiagnosticsResidentUnsupportedFallsBack verifies a staged
// native sidecar returns its direct publication after a resident code-2 reply.
//
// `lsp-serve` and its accepted request verbs can ship at different times. Once
// the authored resident returns a well-formed code-2 reply, the advertised
// one-shot command remains available. This fixture rejects every resident verb;
// no successful other-verb warmup or actual released older daemon is tested.
//
//  1. Build the package-owned sidecar whose daemon returns code 2.
//  2. Advertise the direct project-diagnostic capability.
//  3. Request a publication and assert the one-shot command answers it.
//  4. Assert both resident rejection and direct fallback occurred once.
//
// @evidence contracts/testing.md#behavioral-verification An actual resident reply with code 2 is followed by an actual one-shot publication with literal URI, one diagnostic and direct code. The fixture's log contains one resident project-diagnostics call and one direct call; no other resident verb is exercised.
// @evidence contracts/testing.md#independent-expectations The expected publication and counts are literals from the sidecar fixture.
// @evidence contracts/testing.md#distinguishing-cases The same binary returns a nonzero resident protocol result and a successful direct result. The test distinguishes fallback from suppressing the direct call, but not other-verb compatibility, transport failure or repeated-query policy.
// @evidence contracts/testing.md#execution-ownership This Go native-boundary entry builds one package-owned static sidecar and runs actual NativePluginSource resident/direct commands against it. It is not a portable unit and installs no SDK consumer; shared experiment selection and preparation equivalence remain separately unconfirmed.
// @evidence contracts/e2e.md#necessary-boundary Real child stdio carries a nonzero resident response followed by a direct command's JSON. Direct store or parser units do not observe that transport-to-fallback connection.
// @evidence contracts/e2e.md#shared-execution One fixture build supplies both resident and direct paths in this entry. A test-local build remains; no cross-case preparation reduction or equivalent shared producer is established by this body.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity An owned temporary directory and test-restored log environment isolate artifact and call log. Registered shutdownResidents closes pipes and kills/waits the owned resident before temporary-root cleanup; this does not certify arbitrary descendants or an installed host lifecycle.
// @evidence contracts/e2e.md#preserved-coverage The original publication URI, single diagnostic code and both literal call-count assertions remain here. Static source relocation and build observation are authored but unexecuted; no donor removal or runtime survival is certified.
func TestLSPProjectDiagnosticsResidentUnsupportedFallsBack(t *testing.T) {
  dir := t.TempDir()
  input, err := os.ReadFile(filepath.Join("..", "..", "test", "fixtures", "e2e", "project_diagnostics_resident_unsupported_falls_back", "sidecar.go.txt"))
  if err != nil {
    t.Fatal(err)
  }
  sidecarSource := filepath.Join(dir, "sidecar.go")
  if err := os.WriteFile(
    sidecarSource,
    input,
    0644,
  ); err != nil {
    t.Fatal(err)
  }
  binary := filepath.Join(dir, "sidecar")
  if runtime.GOOS == "windows" {
    binary += ".exe"
  }
  build := exec.Command("go", "build", "-o", binary, sidecarSource)
  observation := e2etrace.BeginCommand(build, "CombinedOutput")
  output, buildErr := build.CombinedOutput()
  observation.Result(buildErr)
  if buildErr != nil {
    t.Fatalf("go build sidecar failed: %v\n%s", buildErr, output)
  }
  logPath := filepath.Join(dir, "calls.log")
  t.Setenv("TTSC_PROJECT_DIAGNOSTICS_FALLBACK_LOG", logPath)
  plugin := NativeLSPPluginEntry{
    Binary:             binary,
    Name:               "@ttsc/staged",
    ProjectDiagnostics: true,
  }
  source := &NativePluginSource{
    cwd:         dir,
    err:         &bytes.Buffer{},
    plugins:     []NativeLSPPluginEntry{plugin},
    pluginsJSON: "[]",
    tsconfig:    filepath.Join(dir, "tsconfig.json"),
  }
  t.Cleanup(source.shutdownResidents)

  got := source.ProjectDiagnostics()

  if got == nil || got.URI != "file:///project/tsconfig.json" ||
    len(got.Diagnostics) != 1 ||
    got.Diagnostics[0].Code != "direct" {
    t.Fatalf("direct fallback publication = %#v", got)
  }
  calls, err := os.ReadFile(logPath)
  if err != nil {
    t.Fatal(err)
  }
  log := string(calls)
  if strings.Count(log, "resident lsp-project-diagnostics") != 1 {
    t.Fatalf("resident attempt count is wrong:\n%s", log)
  }
  if strings.Count(log, "direct lsp-project-diagnostics") != 1 {
    t.Fatalf("direct fallback count is wrong:\n%s", log)
  }
}
