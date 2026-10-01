//go:build e2e

package paths_test

import (
  "bytes"
  "context"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
  "time"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestCommandCheckCompletesOnCrossVolumeFilesList verifies the sidecar never hangs on two-volume inputs.
//
// Locks the termination fix for #310. A tsconfig `files` list mixing inputs
// from two Windows volumes sent `paths.go::commonSourceDir` into an infinite
// spin at the volume root, so `check` ran until the 10-minute go test timeout
// and left orphaned plugin processes behind. Windows dev boxes and
// windows-latest runners split the repo (D:) and TEMP (C:), which is exactly
// the layout this fixture recreates: the project seeds in the system temp
// dir, the external file next to the repository. Same-volume machines cannot
// express the shape, so they skip.
//
// 1. Seed a no-rootDir project in the temp dir and one `files` entry on the repo volume.
// 2. Run `check` through the real sidecar under a hard 2-minute deadline.
// 3. Assert it exits 0 with no output instead of being killed by the deadline.
//
// @evidence contracts/testing.md#behavioral-verification The actual paths check command processes a files list spanning the temp and repository volumes and must finish with status zero, empty stdout and empty stderr before the local deadlock deadline.
// @evidence contracts/testing.md#independent-expectations The explicit alias import has a real matching source and no type error, so successful quiet check owes empty streams; different fixture VolumeName values establish the regression input independently of commonSourceDir.
// @evidence contracts/testing.md#distinguishing-cases This case owns termination of a real two-volume compiler input population; same-volume machines cannot express it and retain the existing explicit skip, while the source unit owns volume-root traversal calculation.
// @evidence contracts/testing.md#execution-ownership This named E2E entry executes the actual prebuilt sidecar in a cancellable process against real project files, rather than starting the Go tool to reach the check boundary.
// @evidence contracts/e2e.md#necessary-boundary The native command, compiler files membership and paths plugin must cooperate on real volume-separated sources; the path-calculation source unit cannot establish host termination or orphan-process prevention.
// @evidence contracts/e2e.md#shared-execution The case reuses the same per-package producer as the other native command cases; only this distinct cross-volume project and deadline-supervised invocation remain separate, with no per-case Go build.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Temp project and repository-volume external source have separate cleanup owners; CommandContext kills the actual producer on the local deadline, and the runner releases its binary only after the whole test process returns.
// @evidence contracts/e2e.md#preserved-coverage The body asserts, only on machines where the project and the external file are on different volumes, that check --quiet over a files list mixing both volumes returns before a 2-minute deadline with no error and empty trimmed stdout/stderr; on a single-volume machine it skips at L57 and asserts nothing.
func TestCommandCheckCompletesOnCrossVolumeFilesList(t *testing.T) {
  cacheDir := filepath.Join(packageRoot(t), "..", "..", "node_modules", ".cache")
  if err := os.MkdirAll(cacheDir, 0o755); err != nil {
    t.Fatal(err)
  }
  externalDir, err := os.MkdirTemp(cacheDir, "paths-cross-volume-")
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() { _ = os.RemoveAll(externalDir) })
  externalFile := filepath.Join(externalDir, "external.ts")
  writeFile(t, externalFile, `export const external = "ok";`+"\n")

  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]}},"files":["src/main.ts","src/lib/message.ts",` + mustJSON(t, externalFile) + `]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
  if filepath.VolumeName(root) == filepath.VolumeName(externalFile) {
    t.Skipf("requires two volumes, got %q for both fixtures", filepath.VolumeName(root))
  }

  // The deadline turns a regression into a 2-minute failure instead of a
  // suite-wide timeout. Resolve the shared producer before timing the check;
  // the deadline supervises the actual plugin process, never a Go-tool wrapper.
  binary := resolvePluginBinary(t)
  ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
  defer cancel()
  cmd := exec.CommandContext(ctx, binary, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
  cmd.Dir = packageRoot(t)
  if coverDir := os.Getenv("TTSC_PLUGIN_COVERDIR"); coverDir != "" {
    if err := os.MkdirAll(coverDir, 0o755); err != nil {
      t.Fatal(err)
    }
    cmd.Env = append(os.Environ(), "GOCOVERDIR="+coverDir)
  }
  var out, errorOutput bytes.Buffer
  cmd.Stdout, cmd.Stderr = &out, &errorOutput
  err = cmd.Run()
  if ctx.Err() != nil {
    t.Fatalf("cross-volume check hung until the deadline: %v", ctx.Err())
  }
  stdout, stderr := out.String(), errorOutput.String()
  if err != nil || strings.TrimSpace(stdout) != "" || strings.TrimSpace(stderr) != "" {
    t.Fatalf("cross-volume check mismatch: err=%v stdout=%q stderr=%q", err, stdout, stderr)
  }
}
