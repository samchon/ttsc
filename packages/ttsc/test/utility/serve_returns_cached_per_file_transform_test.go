package ttsc_test

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// serveResponse mirrors the JSON reply RunServe writes per transform request.
type serveResponse struct {
  TypeScript string `json:"typescript"`
  Found      bool   `json:"found"`
}

// serveRequestLine encodes one resident-host transform request line.
func serveRequestLine(t *testing.T, file string) string {
  t.Helper()
  data, err := json.Marshal(map[string]string{"file": file})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// TestUtilityServeReturnsCachedPerFileTransform verifies the resident serve host
// transforms the project once and then answers per-file requests from its cache:
// the same file requested twice returns the identical cached transform, and a
// file outside the program is reported not-found.
//
// This is the resident transform host of samchon/ttsc#255: one warm process
// answers per-file requests without recompiling the project per call. The host
// keys its cache exactly like the transform envelope (project-relative paths)
// and accepts absolute request paths.
//
//  1. Build a single-file project (no plugins, so transform yields the source).
//  2. Feed RunServe the project file twice, then a non-project file.
//  3. Assert the two project-file replies are identical (served from cache) and
//     the non-project reply is not-found.
func TestUtilityServeReturnsCachedPerFileTransform(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  index := filepath.Join(root, "index.ts")
  requests := serveRequestLine(t, index) + "\n" +
    serveRequestLine(t, index) + "\n" +
    serveRequestLine(t, filepath.Join(root, "missing.ts")) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 3 {
    t.Fatalf("expected one reply per request, got %d: %q", len(lines), out.String())
  }

  var first serveResponse
  if err := json.Unmarshal([]byte(lines[0]), &first); err != nil {
    t.Fatalf("decode reply 0: %v (%q)", err, lines[0])
  }
  if !first.Found || !strings.Contains(first.TypeScript, "value") {
    t.Fatalf("resident serve did not return the transformed source: %q", lines[0])
  }
  // The same file requested again must return the identical cached transform.
  if lines[1] != lines[0] {
    t.Fatalf("repeated request was not served from cache: %q vs %q", lines[1], lines[0])
  }

  var missing serveResponse
  if err := json.Unmarshal([]byte(lines[2]), &missing); err != nil {
    t.Fatalf("decode reply 2: %v (%q)", err, lines[2])
  }
  if missing.Found {
    t.Fatalf("expected a non-project file to be reported not-found: %q", lines[2])
  }
}

// TestUtilityServeMalformedRequestStaysFIFOAligned verifies a malformed request
// line consumes exactly one reply (an empty not-found response) and does not
// desync the reply stream: a valid request after it still resolves correctly.
//
// The line protocol matches replies to requests by order, so a malformed line
// that produced zero or two replies would shift every later reply onto the wrong
// request.
func TestUtilityServeMalformedRequestStaysFIFOAligned(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  requests := "this is not json\n" +
    serveRequestLine(t, filepath.Join(root, "index.ts")) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 2 {
    t.Fatalf("expected one reply per request line, got %d: %q", len(lines), out.String())
  }

  var bad serveResponse
  if err := json.Unmarshal([]byte(lines[0]), &bad); err != nil {
    t.Fatalf("malformed-request reply was not valid JSON: %v (%q)", err, lines[0])
  }
  if bad.Found {
    t.Fatalf("malformed request should reply not-found: %q", lines[0])
  }

  var good serveResponse
  if err := json.Unmarshal([]byte(lines[1]), &good); err != nil {
    t.Fatalf("decode reply 1: %v (%q)", err, lines[1])
  }
  if !good.Found || !strings.Contains(good.TypeScript, "value") {
    t.Fatalf("valid request after a malformed line did not resolve: %q", lines[1])
  }
}

// TestUtilityServeProcessesFinalLineWithoutNewline verifies a request that is
// not newline-terminated (the input ends mid-line at EOF) is still answered
// exactly once. ReadString returns the final line together with io.EOF, so the
// loop must process it before terminating; a naive loop would drop it.
func TestUtilityServeProcessesFinalLineWithoutNewline(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  // The request line has no trailing newline.
  requests := serveRequestLine(t, filepath.Join(root, "index.ts"))

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 1 {
    t.Fatalf("expected exactly one reply for a newline-less request, got %d: %q", len(lines), out.String())
  }
  var reply serveResponse
  if err := json.Unmarshal([]byte(lines[0]), &reply); err != nil {
    t.Fatalf("decode reply: %v (%q)", err, lines[0])
  }
  if !reply.Found || !strings.Contains(reply.TypeScript, "value") {
    t.Fatalf("newline-less request was not answered correctly: %q", lines[0])
  }
}
