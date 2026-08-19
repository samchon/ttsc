package evidence

import (
  "errors"
  "io/fs"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestZZProbeRenderMessages(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  denied := &fs.PathError{Op: "open", Path: filepath.Join(root, "..", "contracts"), Err: errors.New("permission denied")}
  notexist := &fs.PathError{Op: "stat", Path: "x", Err: fs.ErrNotExist}
  out := []string{}
  for _, declared := range []string{"../contracts", "C:/contracts", "/srv/contracts", "//server/share", "C:/", "D:/"} {
    base := resolvePopulationBase(root, declared)
    for _, kind := range []artifactKind{artifactMarkdown, artifactPrisma, artifactTypeScript} {
      out = append(out, "=== declared="+declared+" kind="+string(kind)+" default="+boolstr(base.Default)+" display="+base.Display)
      out = append(out, "  ABSENT     : "+describeBaseDirectoryProblem(base, kind, false, notexist))
      out = append(out, "  OCCUPIED   : "+describeBaseDirectoryProblem(base, kind, true, nil))
      out = append(out, "  UNEXAMIN.  : "+describeBaseDirectoryProblem(base, kind, false, denied))
      out = append(out, "  UNLISTABLE : "+unlistableBaseProblem(base, "Markdown", denied))
      out = append(out, "  DISPLAY    : "+base.display("requirements/pricing.md"))
    }
  }
  def := resolvePopulationBase(root, "")
  out = append(out, "=== DEFAULT base display="+def.Display+" unlistable: "+unlistableBaseProblem(def, "Markdown", denied))
  out = append(out, "  DISPLAY    : "+def.display("requirements/pricing.md"))
  msg, ok := unreadableEntryProblem(resolvePopulationBase(root, "../documents"), filepath.Join(root, "..", "documents"), "Markdown", filepath.Join(root, "..", "documents", "requirements", "private"), denied, func(string) bool { return true })
  out = append(out, "=== ENTRY ok="+boolstr(ok)+" : "+msg)
  _ = os.Stat
  t.Fatalf("PROBE\n%s", strings.Join(out, "\n"))
}

func boolstr(v bool) string {
  if v {
    return "true"
  }
  return "false"
}
