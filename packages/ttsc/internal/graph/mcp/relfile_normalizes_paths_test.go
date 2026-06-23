package mcp

import "testing"

// TestRelFileNormalizesPaths pins relFile, which shortens an absolute workspace
// path to one relative to the server cwd. A round-1 reviewer noted two gaps: a
// cwd with a trailing separator should still match, and a path outside the root
// should be returned forward-slash-normalized rather than in its OS-native form,
// so no single response mixes separators.
func TestRelFileNormalizesPaths(t *testing.T) {
  cases := []struct {
    name string
    cwd  string
    file string
    want string
  }{
    {"plain", "C:/proj", "C:/proj/src/a.ts", "src/a.ts"},
    {"trailing slash root", "C:/proj/", "C:/proj/src/a.ts", "src/a.ts"},
    {"backslash inputs", "C:\\proj", "C:\\proj\\src\\b.ts", "src/b.ts"},
    {"out of root normalized", "C:\\proj", "D:\\libs\\x.d.ts", "D:/libs/x.d.ts"},
    {"empty cwd unchanged", "", "C:\\abs\\c.ts", "C:\\abs\\c.ts"},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      s := &Server{cwd: c.cwd}
      if got := s.relFile(c.file); got != c.want {
        t.Fatalf("relFile(%q) with cwd %q = %q, want %q", c.file, c.cwd, got, c.want)
      }
    })
  }
}
