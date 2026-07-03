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
// backslash separators, the form Node's path.resolve produces natively on
// Windows.
//
// samchon/ttsc#319: TypeScript-Go always normalizes SourceFile.FileName() to
// forward slashes, and buildServeCache keys its per-file cache off that
// normalized name. Before this fix, resolveServePath passed a caller-supplied
// path through unchanged (filepath.Join/pass-through), so a backslash request
// path never matched the forward-slash cache key and the file reported
// not-found — the same class of mismatch behind the "fileName should be
// normalized and absolute" panic a linked plugin hit on Windows. Building the
// request path with a literal backslash (instead of filepath.Join, which
// would use "/" on a non-Windows test runner) reproduces the mismatch on any
// host OS.
//
//  1. Build a single-file project.
//  2. Request the file using a path whose final segment is joined with "\"
//     instead of the host OS's separator.
//  3. Assert the resident host still finds and transforms the file.
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
