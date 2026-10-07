package lspserver

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestReloadFingerprintsReadAJunctionAsALink verifies the Go startup validator
// fingerprints one Windows junction using independently framed link records.
//
// The launcher's Node reads a junction as a symbolic link with its target, and
// Go reports it as an irregular entry, so hashing it as `other` would make an
// exact input that is a junction, and a reload directory holding one, never match
// the digests the launcher recorded: pnpm links a package into node_modules as a
// junction on Windows, and a plugin selection loaded through one would refuse
// every session as changed during startup.
//
//  1. Create a junction to a directory, inside a directory, on Windows.
//  2. Assert the exact-file fingerprint is the protocol's symlink record: the
//     target, then missing content, as a directory reads as none.
//  3. Assert the directory fingerprint lists the junction as a symlink with its
//     target.
//
// @evidence contracts/testing.md#behavioral-verification On Windows actual exact-file and immediate-directory topology digests match independently framed symlink records for a created junction. The directory target contributes missing file content; no actual launcher, pnpm installation or startup session is executed.
// @evidence contracts/testing.md#independent-expectations Literal file framing and literal link-name/kind topology framing feed a separate SHA-256 calculation. Target bytes come from native os.Readlink, so this distinguishes record-kind/framing errors without independently certifying native target spelling or Node parity.
// @evidence contracts/testing.md#distinguishing-cases One junction to an empty directory is checked both as an exact file and as the single immediate topology entry. Other entry kinds, retargeting and unreadable targets are not exercised; non-Windows discovery reaches an explicit runtime skip.
// @evidence contracts/testing.md#execution-ownership The Go unit is discoverable on all platforms and uses a runtime Windows guard, not a Windows build tag. On Windows it owns temporary directories, creates the junction through actual windowsjunction.Create and its native setup child, then calls both actual digest operations. No sidecar, installed consumer, Node launcher or product host runs.
func TestReloadFingerprintsReadAJunctionAsALink(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("junctions exist only on Windows")
  }
  root := t.TempDir()
  target := filepath.Join(root, "target")
  if err := os.Mkdir(target, 0o755); err != nil {
    t.Fatal(err)
  }
  parent := filepath.Join(root, "parent")
  if err := os.Mkdir(parent, 0o755); err != nil {
    t.Fatal(err)
  }
  junction := filepath.Join(parent, "link")
  if err := windowsjunction.Create(junction, target); err != nil {
    t.Fatal(err)
  }
  retained, err := os.Readlink(junction)
  if err != nil {
    t.Fatal(err)
  }

  file := sha256.New()
  file.Write([]byte("symlink\x00"))
  file.Write([]byte(retained))
  file.Write([]byte{0})
  file.Write([]byte("missing\x00"))
  if got, want := projectInputReloadFileDigest(junction),
    fmt.Sprintf("%x", file.Sum(nil)); got != want {
    t.Fatalf("junction digest = %s, want the symlink protocol %s", got, want)
  }

  topology := sha256.New()
  topology.Write([]byte("link\x00symlink\x00" + retained))
  if got, want := projectInputReloadDirectoryTopologyDigest(parent),
    fmt.Sprintf("%x", topology.Sum(nil)); got != want {
    t.Fatalf(
      "directory digest = %s, want the junction listed as a symlink %s",
      got,
      want,
    )
  }
}
