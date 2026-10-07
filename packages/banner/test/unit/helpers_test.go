package banner_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// requireNoAmbientInstall skips the case when a real install of pkg answers
// above the fixture.
//
// The negative resolutions assert that a project answers with nothing, and the
// walk they exercise climbs to the filesystem root by design, exactly as Node's
// does. A stray install above the system temp directory would answer for the
// project the case deliberately left empty, and the failure would read as a
// defect in the resolution rather than as pollution outside the tree. The probe
// anchors one level above `root`, so it inspects the ambient ancestry only and
// never the fixture.
func requireNoAmbientInstall(t *testing.T, root, pkg string) {
  t.Helper()
  probe := filepath.Join(filepath.Dir(root), "ambient-probe-anchor")
  if found := bannerNodePackageManifestFrom(probe, pkg); found != "" {
    t.Skipf("an ambient %s install at %s answers above the fixture", pkg, found)
  }
}

// seedProjectTtsc materializes the `ttsc` install a project-anchored launcher
// resolution walks to, under `root`'s node_modules, and returns the launcher
// path it should produce. Only the manifest and `lib/launcher/ttsx.js` matter;
// nothing spawns the file, so its contents are irrelevant.
func seedProjectTtsc(t *testing.T, root string) string {
  t.Helper()
  launcher := shared.SeedProjectTtscWithoutLauncher(t, root)
  shared.WriteFile(t, launcher, "")
  return launcher
}

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// runPlugin runs the sidecar command dispatch in this process and captures its
// status and both streams. The banner registration comes from the driver import
// in linkname_helpers_test.go; the shared utility host does the project work.
func runPlugin(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  var stdout, stderr bytes.Buffer
  code := utility.RunCommandWithIO("@ttsc/banner", "0.0.1", args, &stdout, &stderr)
  return code, stdout.String(), stderr.String()
}

// seedProject materializes a project-shaped fixture tree. The banner plugin is
// tested through real tsconfig projects rather than mocked compiler inputs.
func seedProject(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for name, text := range files {
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}

// mustJSON serializes plugin manifests used by the sidecar command tests.
func mustJSON(t *testing.T, value any) string {
  t.Helper()
  data, err := json.Marshal(value)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// readFile reads emitted project output and fails the test with the path still
// present in the stack when output is missing.
func readFile(t *testing.T, file string) string {
  t.Helper()
  data, err := os.ReadFile(file)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// writeExecutable writes a launcher fixture with executable mode.
func writeExecutable(t *testing.T, file string, contents string) string {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o755); err != nil {
    t.Fatal(err)
  }
  return file
}

// writeDirectLauncher writes a fake launcher that prints fixed bytes and
// exits. POSIX gets a `#!/bin/sh` script; Windows cannot spawn an
// extensionless shell script, so it gets the equivalent `.cmd` batch file and
// the returned path carries that extension. Both stay OFF the script-extension
// list, preserving the direct-exec (not node-routed) classification under
// test. Payloads must avoid cmd metacharacters (%, ^, &, |, <, >), because batch has
// no way to quote them that sh's single quotes would mirror.
func writeDirectLauncher(t *testing.T, file, stdout, stderr string, exitCode int) string {
  t.Helper()
  var b strings.Builder
  if runtime.GOOS == "windows" {
    b.WriteString("@echo off\r\n")
    if stdout != "" {
      b.WriteString("echo " + stdout + "\r\n")
    }
    if stderr != "" {
      // The redirect goes up front: a trailing `1>&2` would emit "x ", and
      // a bare `>&2` glued to a payload ending in a digit would turn that
      // digit into a file-descriptor redirect.
      b.WriteString("1>&2 echo " + stderr + "\r\n")
    }
    b.WriteString("exit /b " + strconv.Itoa(exitCode) + "\r\n")
    return writeExecutable(t, file+".cmd", b.String())
  }
  b.WriteString("#!/bin/sh\n")
  if stdout != "" {
    b.WriteString("printf '" + stdout + "'\n")
  }
  if stderr != "" {
    b.WriteString("printf '" + stderr + "' >&2\n")
  }
  if exitCode != 0 {
    b.WriteString("exit " + strconv.Itoa(exitCode) + "\n")
  }
  return writeExecutable(t, file, b.String())
}

// bannerManifest builds the plugin manifest shape that ttsc passes to native
// plugins through --plugins-json. It writes a temporary banner.config.cjs file
// in dir exporting an object with a "text" string and returns a manifest that
// references it via "configFile".
func bannerManifest(t *testing.T, dir, text string) string {
  t.Helper()
  configFile := filepath.Join(dir, "banner.config.cjs")
  body := "module.exports = { text: " + mustJSON(t, text) + " };\n"
  if err := os.WriteFile(configFile, []byte(body), 0o644); err != nil {
    t.Fatal(err)
  }
  return mustJSON(t, []map[string]any{{
    "name":  "@ttsc/banner",
    "stage": "transform",
    "config": map[string]any{
      "transform":  "@ttsc/banner",
      "configFile": configFile,
    },
  }})
}

// bannerPrefix mirrors the JSDoc banner text expected from the shared utility
// transform host, keeping build assertions focused on the sidecar contract.
func bannerPrefix(text string) string {
  sep := strings.Repeat("-", 64)
  return "/**\n * " + sep + "\n * " + text + "\n *\n * @packageDocumentation\n */\n"
}
