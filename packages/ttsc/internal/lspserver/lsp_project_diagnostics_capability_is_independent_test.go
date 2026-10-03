package lspserver

import (
  "bytes"
  "os/exec"
  "strings"
  "testing"
)

// TestLSPProjectDiagnosticsCapabilityIsIndependent verifies the standalone
// diagnostic command is not inferred from project-input topology support.
//
// A third-party sidecar may implement `project-inputs` without implementing
// `lsp-project-diagnostics`, while a staged diagnostic sidecar may expose the
// inverse combination. Probing either command under the other capability makes
// strict sidecars fail an undocumented command.
//
//  1. Configure a topology-only plugin and a diagnostics-only plugin.
//  2. Seed the diagnostics producer, then make its next refresh fail to launch.
//  3. Assert only the explicitly capable producer appears in failed-call logs.
//  4. Assert one retained diagnostic still carries its last-good code.
//
// @evidence contracts/testing.md#behavioral-verification The failed refresh logs the diagnostics-only descriptor's name but not the topology-only name; its aggregate still contains one diagnostic with literal last-good code. These error-name observations distinguish selection here, not a successful protocol response or every retained field.
// @evidence contracts/testing.md#independent-expectations Descriptor names, one diagnostic and last-good code are literal expectations. Both binaries are independently required to be absent from executable lookup before the actual failed start paths are reached; absence of a log alone would not establish selection without the positive capable-producer observation.
// @evidence contracts/testing.md#distinguishing-cases A topology-only and a diagnostics-only plugin expose the two capability combinations.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit seeds actual NativePluginSource records and calls ProjectDiagnostics with an owned log buffer and descriptors. Selected command setup reaches failed resident/direct native starts under the missing-binary premise, without an installed consumer, temporary project or running product host.
func TestLSPProjectDiagnosticsCapabilityIsIndependent(t *testing.T) {
  topologyOnly := NativeLSPPluginEntry{
    Binary:        "ttsc-no-such-topology-only-sidecar",
    Name:          "@ttsc/topology-only",
    ProjectInputs: true,
  }
  diagnosticsOnly := NativeLSPPluginEntry{
    Binary:             "ttsc-no-such-diagnostics-only-sidecar",
    Name:               "@ttsc/diagnostics-only",
    ProjectDiagnostics: true,
  }
  for _, plugin := range []NativeLSPPluginEntry{topologyOnly, diagnosticsOnly} {
    if path, err := exec.LookPath(plugin.Binary); err == nil {
      t.Fatalf("missing-binary premise is false: %s", path)
    }
  }
  var log bytes.Buffer
  source := &NativePluginSource{
    err:     &log,
    plugins: []NativeLSPPluginEntry{topologyOnly, diagnosticsOnly},
  }
  source.storeProjectDiagnostics(
    diagnosticsOnly,
    1,
    &LSPProjectDiagnostics{
      URI: "file:///project/tsconfig.json",
      Diagnostics: []LSPDiagnostic{{
        Code:    "last-good",
        Message: "last-good",
      }},
    },
  )

  got := source.ProjectDiagnostics()

  if strings.Contains(log.String(), topologyOnly.Name) {
    t.Fatalf(
      "projectInputs incorrectly enabled lsp-project-diagnostics:\n%s",
      log.String(),
    )
  }
  if !strings.Contains(log.String(), diagnosticsOnly.Name) {
    t.Fatalf(
      "projectDiagnostics did not enable its direct command:\n%s",
      log.String(),
    )
  }
  if got == nil || len(got.Diagnostics) != 1 ||
    got.Diagnostics[0].Code != "last-good" {
    t.Fatalf("failed capable producer lost its last-good publication: %#v", got)
  }
}
