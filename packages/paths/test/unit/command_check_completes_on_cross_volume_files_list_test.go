package paths_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
  "time"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestCommandCheckCompletesOnCrossVolumeFilesList verifies the check command never hangs on two-volume inputs.
//
// Recreates the input of the #310 hang. A tsconfig `files` list mixing inputs
// from two Windows volumes sent `paths.go::commonSourceDir` into an infinite
// spin at the volume root, so `check` ran until the 10-minute go test timeout
// and left orphaned plugin processes behind. Windows dev boxes and
// windows-latest runners split the repo (D:) and TEMP (C:), which is exactly
// the layout this fixture recreates: the project seeds in the system temp
// dir, the external file next to the repository. Same-volume machines cannot
// express the shape, so they skip.
//
// A Program loaded from a tsconfig always carries that config path, and the
// rewriter anchors an omitted rootDir there, so today this input no longer
// reaches `commonSourceDir`. The case guards the whole check path against a
// hang on two-volume membership; the volume-root termination itself is owned by
// TestRewriterCommonSourceDirTerminatesAtVolumeRoots.
//
// 1. Seed a no-rootDir project in the temp dir and one `files` entry on the repo volume.
// 2. Run `check` through the shared command dispatch under a hard 2-minute deadline.
// 3. Assert it exits 0 with no output instead of being killed by the deadline.
//
// @evidence contracts/testing.md#behavioral-verification The actual paths check command processes a files list spanning the temp and repository volumes and must finish with status zero, empty stdout and empty stderr before the local deadlock deadline.
// @evidence contracts/testing.md#independent-expectations The explicit alias import has a real matching source and no type error, so successful quiet check owes empty streams; different fixture VolumeName values establish the regression input independently of commonSourceDir.
// @evidence contracts/testing.md#distinguishing-cases This case owns termination of a real two-volume compiler input population; same-volume machines cannot express it and retain the existing explicit skip, while the source unit owns volume-root traversal calculation.
// @evidence contracts/testing.md#execution-ownership The named entry is in test/unit and calls utility.RunCommandWithIO, the dispatch the standalone main delegates to, in this Go process with the paths plugin linked by the driver import and a t-owned fixture project; no built binary or child process is started.
func TestCommandCheckCompletesOnCrossVolumeFilesList(t *testing.T) {
  // A Go test runs in its package directory, packages/paths/test/unit, so four
  // levels up is the repository root on the repository volume.
  cacheDir, err := filepath.Abs(filepath.Join("..", "..", "..", "..", "node_modules", ".cache"))
  if err != nil {
    t.Fatal(err)
  }
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
  // suite-wide timeout. The dispatch runs in a goroutine so the supervisor can
  // report a hang; the buffered channel lets a late return finish unobserved.
  type result struct {
    status         int
    stdout, stderr string
  }
  done := make(chan result, 1)
  go func() {
    status, stdout, stderr := runCommand("check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
    done <- result{status, stdout, stderr}
  }()
  select {
  case got := <-done:
    if got.status != 0 || strings.TrimSpace(got.stdout) != "" || strings.TrimSpace(got.stderr) != "" {
      t.Fatalf("cross-volume check mismatch: status=%d stdout=%q stderr=%q", got.status, got.stdout, got.stderr)
    }
  case <-time.After(2 * time.Minute):
    t.Fatal("cross-volume check hung until the deadline")
  }
}
