package banner_test

import (
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// @evidence contracts/testing.md#behavioral-verification windowsjunction.Create receives source/target names with &, ^, !, parentheses and a percent-delimited variable; the link must read safe and the variable-expanded spelling must not exist.
// @evidence contracts/testing.md#independent-expectations Literal path names are filesystem data. Authored safe bytes and absent expanded spelling reject shell interpolation independently of the junction implementation.
// @evidence contracts/testing.md#distinguishing-cases The deliberately set variable and multiple cmd metacharacters distinguish literal arguments from expansion. Non-Windows runs skip all assertions.
// @evidence contracts/testing.md#execution-ownership This named Go entry calls the shared real Windows junction creator and reads through its filesystem link; no plugin or compiler executes.
// @evidence contracts/e2e.md#necessary-boundary Actual Windows command argument transport and junction traversal require the OS boundary. Banner and strip contain identical inputs against the same shared creator, so duplicate package copies do not provide unique integration coverage.
// @evidence contracts/e2e.md#shared-execution Only a temporary target, link and one short junction command are prepared. There is no native producer or install; the duplicate banner/strip case remains a consolidation candidate.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.Setenv restores the variable and t.TempDir releases target, link and sentinel. No cache or resident process is retained.
// @evidence contracts/e2e.md#preserved-coverage The body asserts the sentinel content read through the junction (L43) and the absence of the percent-expanded spelling (L47); it skips on non-Windows so nothing is asserted there. The test drives packages/ttsc/driver/windowsjunction.Create and no banner code.
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
