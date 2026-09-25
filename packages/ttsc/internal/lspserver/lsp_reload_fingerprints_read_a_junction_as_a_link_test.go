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
// fingerprints a Windows junction the way the launcher does.
//
// The launcher's Node reads a junction as a symbolic link with its target, and
// Go reports it as an irregular entry, so the host hashed an exact input that
// was a junction, and a reload directory holding one, as `other`. The digests
// the launcher recorded then never matched: pnpm links a package into
// node_modules as a junction on Windows, and a plugin selection loaded through
// one refused every session as changed during startup (samchon/ttsc#1507).
//
//  1. Create a junction to a directory, inside a directory, on Windows.
//  2. Assert the exact-file fingerprint is the protocol's symlink record: the
//     target, then missing content, as a directory reads as none.
//  3. Assert the directory fingerprint lists the junction as a symlink with its
//     target.
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
