package linthost

import (
  "runtime"
  "testing"
)

// TestFileURLMatchesNodeShape verifies the file URL strings generated for the
// ephemeral TypeScript config loader. Node consumes these with dynamic import,
// so the Go side must match Node's pathToFileURL shape for Windows drive and
// UNC paths, including characters that require URL escaping.
//
// @evidence contracts/testing.md#behavioral-verification fileURL converts an authored absolute path into an exact escaped file URI; the conditional Windows matrix additionally checks drive, UNC, extended-drive and extended-UNC spellings.
// @evidence contracts/testing.md#independent-expectations Literal file-URI expectations preserve path separators and encode spaces, hash and percent as URI path data; the independently authored strings do not reuse fileURL to compute its output.
// @evidence contracts/testing.md#distinguishing-cases The slash-form escaped path runs on every platform. Four Windows spellings exercise native filepath.VolumeName and filepath.ToSlash behavior only on Windows; a Linux-only run does not exercise those native distinctions.
// @evidence contracts/testing.md#execution-ownership TestFileURLMatchesNodeShape owns its named table as one selected Go unit entry invoking fileURL and the current platform's filepath primitives directly without consumers or child hosts. Windows volume parsing belongs to the native Windows unit population; tag presence does not certify execution of those conditional rows.
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
