package main

import (
  "bytes"
  "context"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPUsesNativePluginManifestSource verifies the command wires the
// launcher-provided plugin manifest into the proxy source and then owns it.
//
// A previous implementation always passed NullPluginSource, so editor sessions
// could never receive ttsc plugin diagnostics or commands. The manifest also
// names every resolved plugin and its launch context, so leaving it readable
// for the process lifetime exposes it to any sidecar this host later spawns.
// This test pins both halves of that seam without starting tsgo.
//
//  1. Set the legacy TTSC_LSP_PLUGINS_JSON fallback to a valid manifest.
//  2. Substitute runLSPServer and capture its LSPServerOptions.
//  3. Run `ttscserver --stdio` and assert the native source is selected, and
//     that the legacy payload no longer reaches a spawned sidecar.
//  4. Put a valid manifest in TTSC_LSP_PLUGINS_FILE while making the legacy
//     environment payload invalid, and prove the bounded file transport wins,
//     is deleted once read, and leaves neither variable behind.
//  5. Pass a manifest through --lsp-plugins-file while both environment forms
//     are invalid, and prove the flag transport takes precedence.
//  6. Point the flag at a missing manifest and prove the command fails instead
//     of silently serving a project without its declared plugins.
func TestRunLSPUsesNativePluginManifestSource(t *testing.T) {
  t.Setenv("TTSC_LSP_PLUGINS_JSON", `{"plugins":[],"lspPlugins":[]}`)
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "")

  prev := runLSPServer
  var captured lspserver.LSPServerOptions
  runLSPServer = func(_ context.Context, opts lspserver.LSPServerOptions) error {
    captured = opts
    return nil
  }
  defer func() { runLSPServer = prev }()

  invoke := func(label string, extra ...string) (int, string) {
    t.Helper()
    outBuf := &bytes.Buffer{}
    errBuf := &bytes.Buffer{}
    code := 0
    withIO(t, outBuf, errBuf, nil, func() {
      code = runLSP(append(append([]string{}, extra...), []string{
        "--stdio",
        "--cwd",
        t.TempDir(),
        "--tsconfig",
        "tsconfig.app.json",
      }...))
    })
    return code, errBuf.String()
  }
  run := func(label string, extra ...string) {
    t.Helper()
    code, stderrText := invoke(label, extra...)
    if code != 0 {
      t.Fatalf("%s: expected exit 0, got %d (stderr=%q)", label, code, stderrText)
    }
    if _, ok := captured.Source.(*lspserver.NativePluginSource); !ok {
      t.Fatalf("%s: expected NativePluginSource, got %T", label, captured.Source)
    }
    for _, name := range []string{
      "TTSC_LSP_PLUGINS_FILE",
      "TTSC_LSP_PLUGINS_JSON",
    } {
      if value := os.Getenv(name); value != "" {
        t.Fatalf("%s: %s survived startup as %q", label, name, value)
      }
    }
  }
  writeManifest := func() string {
    t.Helper()
    location := filepath.Join(t.TempDir(), "plugins.json")
    if err := os.WriteFile(
      location,
      []byte(`{"plugins":[],"lspPlugins":[]}`),
      0o600,
    ); err != nil {
      t.Fatal(err)
    }
    return location
  }

  run("legacy JSON")

  environmentManifest := writeManifest()
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "{invalid")
  t.Setenv("TTSC_LSP_PLUGINS_FILE", environmentManifest)
  run("manifest file")
  if _, err := os.Stat(environmentManifest); !os.IsNotExist(err) {
    t.Fatalf("environment manifest survived startup: %v", err)
  }

  flagManifest := writeManifest()
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "{invalid")
  t.Setenv("TTSC_LSP_PLUGINS_FILE", filepath.Join(t.TempDir(), "absent.json"))
  run("manifest flag", "--lsp-plugins-file", flagManifest)
  if _, err := os.Stat(flagManifest); !os.IsNotExist(err) {
    t.Fatalf("flag manifest survived startup: %v", err)
  }

  t.Setenv("TTSC_LSP_PLUGINS_JSON", `{"plugins":[],"lspPlugins":[]}`)
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "")
  code, stderrText := invoke(
    "missing manifest",
    "--lsp-plugins-file",
    filepath.Join(t.TempDir(), "absent.json"),
  )
  if code == 0 {
    t.Fatal("a missing manifest must not start the host")
  }
  if !bytes.Contains([]byte(stderrText), []byte("--lsp-plugins-file")) {
    t.Fatalf("expected the failing transport to be named, got %q", stderrText)
  }
}
