package paths_test

import (
  "context"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
  "time"
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

  root := seedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]}},"files":["src/main.ts","src/lib/message.ts",` + mustJSON(t, externalFile) + `]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
  if filepath.VolumeName(root) == filepath.VolumeName(externalFile) {
    t.Skipf("requires two volumes, got %q for both fixtures", filepath.VolumeName(root))
  }

  // The deadline turns a regression into a 2-minute failure instead of a
  // suite-wide 10-minute timeout. `go run` itself is prewarmed by the suite
  // runner, so a healthy check completes in seconds.
  ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
  defer cancel()
  cmd := exec.CommandContext(ctx, "go", "run", "./plugin", "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
  cmd.Dir = packageRoot(t)
  out, err := cmd.Output()
  if ctx.Err() != nil {
    t.Fatalf("cross-volume check hung until the deadline: %v", ctx.Err())
  }
  stderr := ""
  if exit, ok := err.(*exec.ExitError); ok {
    stderr = string(exit.Stderr)
  }
  if err != nil || strings.TrimSpace(string(out)) != "" || strings.TrimSpace(stderr) != "" {
    t.Fatalf("cross-volume check mismatch: err=%v stdout=%q stderr=%q", err, out, stderr)
  }
}
