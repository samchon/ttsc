package evidence

import (
  "path/filepath"
  "strings"
)

// generalRelativeProjectPath is the form the shortcut stands in for, kept here
// so the comparison is against the rule rather than against a remembered answer.
func generalRelativeProjectPath(root string, absolute string) (string, bool) {
  if root == "" || absolute == "" {
    return "", false
  }
  relative, err := filepath.Rel(root, absolute)
  if err != nil {
    return "", false
  }
  relative = strings.ReplaceAll(relative, "\\", "/")
  if relative == ".." || strings.HasPrefix(relative, "../") {
    return "", false
  }
  return strings.TrimPrefix(relative, "./"), true
}

func generalProjectPath(root string, relative string) string {
  local := filepath.FromSlash(relative)
  absolute := local
  if !filepath.IsAbs(local) {
    absolute = filepath.Join(filepath.FromSlash(root), local)
  }
  projectRelative, err := filepath.Rel(
    filepath.FromSlash(root),
    filepath.Clean(absolute),
  )
  if err != nil {
    return filepath.ToSlash(filepath.Clean(absolute))
  }
  return strings.TrimPrefix(filepath.ToSlash(projectRelative), "./")
}
