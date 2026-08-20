package linthost

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

func TestWindowsJunctionTreatsPathsAsData(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("Windows junction boundary")
  }
  t.Setenv("TTSC_WINDOWS_JUNCTION_PROBE", "expanded")
  root := t.TempDir()
  target := filepath.Join(root, "target & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  link := filepath.Join(root, "link & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(target, "sentinel.txt"), []byte("safe"), 0o644); err != nil {
    t.Fatal(err)
  }

  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }
  got, err := os.ReadFile(filepath.Join(link, "sentinel.txt"))
  if err != nil {
    t.Fatal(err)
  }
  if string(got) != "safe" {
    t.Fatalf("junction read %q, want safe", got)
  }
  expanded := strings.ReplaceAll(link, "%TTSC_WINDOWS_JUNCTION_PROBE%", "expanded")
  if _, err := os.Lstat(expanded); !os.IsNotExist(err) {
    t.Fatalf("cmd.exe expanded a percent sequence into %s: %v", expanded, err)
  }
}

func TestWindowsJunctionDependencyEntryMatchesNodeFingerprint(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("Windows junction boundary")
  }
  root := t.TempDir()
  target := filepath.Join(root, "target")
  link := filepath.Join(root, "link")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }
  linkTarget, err := os.Readlink(link)
  if err != nil {
    t.Fatalf("read junction target: %v", err)
  }
  h := sha256.New()
  h.Write([]byte("symlink\x00"))
  h.Write([]byte(linkTarget))
  want := hex.EncodeToString(h.Sum(nil))
  got, err := configDependencyDigest(configDependencyFingerprint{
    Path: link,
    Kind: configDependencyEntry,
  })
  if err != nil {
    t.Fatalf("digest junction entry: %v", err)
  }
  if got != want {
    t.Fatalf("junction entry digest = %q, want Node symlink digest %q", got, want)
  }
}
