package linthost

import (
  "runtime"
  "testing"
)

// TestFileURLMatchesNodeShape pins the file URL strings generated for the
// ephemeral TypeScript config loader. Node consumes these with dynamic import,
// so the Go side must match Node's pathToFileURL shape for Windows drive and
// UNC paths, including characters that require URL escaping.
func TestFileURLMatchesNodeShape(t *testing.T) {
  type testCase struct {
    name     string
    location string
    want     string
  }

  cases := []testCase{
    {
      name:     "posix escapes path characters",
      location: "/tmp/a b/#lint%.config.ts",
      want:     "file:///tmp/a%20b/%23lint%25.config.ts",
    },
  }

  if runtime.GOOS == "windows" {
    cases = append(cases,
      testCase{
        name:     "windows drive path",
        location: `C:\a b\#lint%.config.ts`,
        want:     "file:///C:/a%20b/%23lint%25.config.ts",
      },
      testCase{
        name:     "windows unc path",
        location: `\\server\share\a b\lint.config.ts`,
        want:     "file://server/share/a%20b/lint.config.ts",
      },
      testCase{
        name:     "windows extended drive path",
        location: `\\?\C:\a b\lint.config.ts`,
        want:     "file:///C:/a%20b/lint.config.ts",
      },
      testCase{
        name:     "windows extended unc path",
        location: `\\?\UNC\server\share\a b\lint.config.ts`,
        want:     "file://server/share/a%20b/lint.config.ts",
      },
    )
  }

  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      if got := fileURL(c.location); got != c.want {
        t.Fatalf("fileURL(%q) = %q, want %q", c.location, got, c.want)
      }
    })
  }
}
