package paths_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// Verifies paths: a source's output lands below outDir by the compiler host's
// case rule, not the operating system's.
//
// A Program can spell a file the way a paths target named it: an alias to
// `./SRC/DIRECTORY` loads `src/directory/index.ts` as `SRC/DIRECTORY/index.ts`.
// The output path came from `filepath.Rel`, which is case-sensitive on POSIX
// and case-insensitive on Windows. On a case-insensitive macOS volume the
// source then fell outside rootDir and the alias stayed in the emitted
// JavaScript, and on Windows a case-sensitive host was treated as insensitive.
// TypeScript-Go places the output by the host's rule and keeps the rest of the
// source's own spelling (`outputpaths.GetSourceFilePathInNewDir`).
//
//  1. Build a case-insensitive and a case-sensitive rewriter over one rootDir.
//  2. Place a source spelled in other case below rootDir, and one in a sibling
//     directory that shares rootDir's name as a prefix.
//  3. Assert only the insensitive host places the first, keeping its spelling, and
//     neither places the sibling.
//
// @evidence contracts/testing.md#behavioral-verification Calls pathsOutputPathForSource under exact/insensitive policies and asserts uppercase SRC containment only when insensitive, src2 exclusion and ordinary src success.
// @evidence contracts/testing.md#independent-expectations Root containment follows host case identity while preserving source suffix spelling; literal dist/DIRECTORY/index.js, empty and dist/index.js answers distinguish each branch.
// @evidence contracts/testing.md#distinguishing-cases Owns case-only root spelling, sibling prefix src2 and matching spelling under both policies; suffix variety is owned by the emitted-extension matrix.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRewriterPlacesOutputBelowRootDirByHostCaseRule is selected from test/unit by the utility runner unit overlay. Runs pathsOutputPathForSource with synthetic strings.ToLower or exact identity in the Go process; no case-insensitive volume or compiler Program is required.
func TestRewriterPlacesOutputBelowRootDirByHostCaseRule(t *testing.T) {
  root := filepath.ToSlash(filepath.Join(t.TempDir(), "Repo"))
  insensitive := &pathsRewriter{
    canonicalFileName: strings.ToLower,
    outDir:            root + "/dist",
    rootDir:           root + "/src",
  }
  sensitive := &pathsRewriter{
    outDir:  root + "/dist",
    rootDir: root + "/src",
  }

  source := root + "/SRC/DIRECTORY/index.ts"
  if got := pathsOutputPathForSource(insensitive, source); got != root+"/dist/DIRECTORY/index.js" {
    t.Fatalf("case-insensitive host output mismatch: %q", got)
  }
  if got := pathsOutputPathForSource(sensitive, source); got != "" {
    t.Fatalf("case-sensitive host placed %q below rootDir as %q", source, got)
  }
  for _, rewriter := range []*pathsRewriter{insensitive, sensitive} {
    if got := pathsOutputPathForSource(rewriter, root+"/src2/index.ts"); got != "" {
      t.Fatalf("a sibling of rootDir was placed below it as %q", got)
    }
    if got := pathsOutputPathForSource(rewriter, root+"/src/index.ts"); got != root+"/dist/index.js" {
      t.Fatalf("a source spelled as rootDir output mismatch: %q", got)
    }
  }
}
