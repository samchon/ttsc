package lspserver

import (
  "bytes"
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
//  3. Assert only the explicitly capable producer was invoked.
//  4. Assert its last-good publication remains available after the failure.
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
