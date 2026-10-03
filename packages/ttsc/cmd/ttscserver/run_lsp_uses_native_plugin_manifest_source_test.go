package main

import (
  "bytes"
  "context"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPUsesNativePluginManifestSource verifies the command wires the
// authored empty manifest transports to native source construction and applies
// their environment-clearing and file-consumption rules.
//
// These fixtures contain no plugin entries. They observe the captured source
// class, parent environment and file presence, not plugin entry transfer,
// sidecar inheritance, maximum-byte limits, or a second editor launch.
//
//  1. Set the legacy TTSC_LSP_PLUGINS_JSON fallback to a valid manifest.
//  2. Substitute runLSPServer and capture its LSPServerOptions.
//  3. Run `ttscserver --stdio` and assert the native source is selected, and
//     that the legacy payload is cleared from this process environment.
//  4. Put a valid manifest in TTSC_LSP_PLUGINS_FILE while making the legacy
//     environment payload invalid, and prove file precedence, environment
//     clearing, and continued file presence after this one invocation.
//  5. Pass a manifest through --lsp-plugins-file while both environment forms
//     are invalid, and prove the flag transport takes precedence and is
//     consumed, because the launcher created that file for this process alone.
//  6. Point the flag at a missing manifest and prove the command fails instead
//     of silently serving a project without its declared plugins.
//
// @evidence contracts/testing.md#behavioral-verification The authored empty manifests yield a captured NativePluginSource and cleared parent manifest variables. The environment file wins over invalid JSON and remains present; the flag file wins over both invalid environment forms and is removed; a missing flag file gives a nonzero result naming the flag. Actual plugin entries, sidecars, size limits, file readability, and repeat launches are not asserted.
// @evidence contracts/testing.md#independent-expectations The expected source selection, environment state and file transport are checked against literal manifests and variables the test sets.
// @evidence contracts/testing.md#distinguishing-cases Legacy JSON, environment file and flag file use authored empty manifests; invalid competing transports distinguish precedence, and a missing flag target distinguishes admission failure. Environment-file retention contrasts with flag-file consumption.
// @evidence contracts/testing.md#execution-ownership This Go unit replaces the owning runLSPServer seam and captures package-owned writers. It directly creates/inspects private manifest files and restores authored environment transports through t.Setenv. Empty plugin lists select no native query, and the host seam starts no process; foreign methods and process streams are unchanged.
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

  invoke := func(extra ...string) (int, string) {
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
    code, stderrText := invoke(extra...)
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
  if _, err := os.Stat(environmentManifest); err != nil {
    t.Fatalf("out-of-band manifest was consumed by its reader: %v", err)
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
    "--lsp-plugins-file",
    filepath.Join(t.TempDir(), "absent.json"),
  )
  if code == 0 {
    t.Fatal("a missing manifest must not start the host")
  }
  if !strings.Contains(stderrText, "--lsp-plugins-file") {
    t.Fatalf("expected the failing transport to be named, got %q", stderrText)
  }
}
