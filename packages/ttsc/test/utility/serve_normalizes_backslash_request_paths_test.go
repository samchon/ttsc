package ttsc_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityServeNormalizesBackslashRequestPaths verifies the resident serve
// host finds a project file even when the request spells its path with
// backslash separators — the form Node's path.resolve produces on Windows,
// and a spelling that can otherwise reach this host on any OS (a
// Windows-authored fixture, a request forwarded from a different machine).
//
// TypeScript-Go always normalizes SourceFile.FileName() to forward slashes, and
// buildServeCache keys its per-file cache off that normalized name. A
// caller-supplied path passed through unchanged would, on a POSIX host, reach
// Go's path/filepath, which treats backslash as an ordinary filename character
// rather than a separator, so apiOutputKey would split the path in the wrong
// place and miss the cache entry. resolveServePath therefore normalizes with
// tspath.ResolvePath, which handles separators independent of the host OS, as
// TypeScript-Go itself does.
//
//  1. Build a single-file project.
//  2. Request the file using a path whose final segment is joined with "\"
//     instead of the host OS's separator.
//  3. Assert the resident host still finds and transforms the file.
//
// @evidence contracts/testing.md#behavioral-verification A serve request that spells a project file with a backslash separator still finds and transforms the file.
// @evidence contracts/testing.md#independent-expectations The expected transform text is the authored source of the project file.
// @evidence contracts/testing.md#distinguishing-cases The backslash spelling is the input a forward-slash-only lookup would miss; the normal spelling is the neighbor served by sibling tests.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeNormalizesBackslashRequestPaths is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityServeNormalizesBackslashRequestPaths(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  backslashPath := strings.TrimRight(root, `/\`) + `\index.ts`
  requests := serveRequestLine(t, backslashPath) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 1 {
    t.Fatalf("expected one reply, got %d: %q", len(lines), out.String())
  }
  var reply serveResponse
  if err := json.Unmarshal([]byte(lines[0]), &reply); err != nil {
    t.Fatalf("decode reply: %v (%q)", err, lines[0])
  }
  if !reply.Found || !strings.Contains(reply.TypeScript, "value") {
    t.Fatalf("resident host did not resolve a backslash-separated request path: %q", lines[0])
  }
}
