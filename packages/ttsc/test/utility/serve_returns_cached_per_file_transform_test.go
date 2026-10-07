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
// answers the authored per-file requests through its maintained cache owner:
// the same file requested twice returns the identical cached transform, and a
// file outside the program is reported not-found.
//
// This is the resident transform host: one warm process
// answers per-file requests; this case does not instrument compilation counts. The host
// keys its cache exactly like the transform envelope (project-relative paths)
// and accepts absolute request paths.
//
//  1. Build a single-file project (no plugins, so transform yields the source).
//  2. Feed RunServe the project file twice, then a non-project file.
//  3. Assert the two project-file replies are identical (served from cache) and
//     the non-project reply is not-found.
//
// @evidence contracts/testing.md#behavioral-verification RunServe answers the same project file twice with identical complete authored transforms and reports a file outside the program as not found. The case does not measure cache hits or Program construction counts.
// @evidence contracts/testing.md#independent-expectations The complete literal export declaration grounds content independently, repeated replies require identity, and not-found is a literal protocol value.
// @evidence contracts/testing.md#distinguishing-cases A project file requested twice contrasts with a non-project file requested once.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeReturnsCachedPerFileTransform is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
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
  if !first.Found || strings.TrimSpace(first.TypeScript) != "export const value: number = 1;" {
    t.Fatalf("resident serve did not return the transformed source: %q", lines[0])
  }
  // Identical replies alone do not measure whether a cache hit occurred.
  if lines[1] != lines[0] {
    t.Fatalf("repeated request was not served from cache: %q vs %q", lines[1], lines[0])
  }

  var missing serveResponse
  if err := json.Unmarshal([]byte(lines[2]), &missing); err != nil {
    t.Fatalf("decode reply 2: %v (%q)", err, lines[2])
  }
  if missing.Found || missing.TypeScript != "" {
    t.Fatalf("expected a non-project file to be reported not-found: %q", lines[2])
  }
  var missingFields map[string]json.RawMessage
  if err := json.Unmarshal([]byte(lines[2]), &missingFields); err != nil {
    t.Fatal(err)
  }
  if string(missingFields["found"]) != "false" || string(missingFields["typescript"]) != `""` {
    t.Fatalf("not-found response must explicitly carry false and empty text: %q", lines[2])
  }
}

// TestUtilityServeMalformedRequestStaysFIFOAligned verifies a malformed request
// line consumes exactly one reply (an empty not-found response) and does not
// desync the reply stream: a valid request after it still resolves correctly.
//
// The line protocol matches replies to requests by order, so a malformed line
// that produced zero or two replies would shift every later reply onto the wrong
// request.
//
// @evidence contracts/testing.md#behavioral-verification A malformed request line consumes exactly one reply (an empty not-found response) and a valid request after it still resolves to its own file.
// @evidence contracts/testing.md#independent-expectations The line protocol matches replies to requests by order, so the expected reply count and the later valid reply are literal.
// @evidence contracts/testing.md#distinguishing-cases Zero or two replies for the malformed line would shift every later reply; the valid request after it detects that desynchronization.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeMalformedRequestStaysFIFOAligned is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
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
  if bad.Found || bad.TypeScript != "" {
    t.Fatalf("malformed request should reply not-found: %q", lines[0])
  }
  var badFields map[string]json.RawMessage
  if err := json.Unmarshal([]byte(lines[0]), &badFields); err != nil {
    t.Fatal(err)
  }
  if string(badFields["found"]) != "false" || string(badFields["typescript"]) != `""` {
    t.Fatalf("malformed reply must explicitly carry false and empty text: %q", lines[0])
  }

  var good serveResponse
  if err := json.Unmarshal([]byte(lines[1]), &good); err != nil {
    t.Fatalf("decode reply 1: %v (%q)", err, lines[1])
  }
  if !good.Found || strings.TrimSpace(good.TypeScript) != "export const value: number = 1;" {
    t.Fatalf("valid request after a malformed line did not resolve: %q", lines[1])
  }
}

// TestUtilityServeProcessesFinalLineWithoutNewline verifies a request that is
// not newline-terminated (the input ends mid-line at EOF) is still answered
// exactly once. ReadString returns the final line together with io.EOF, so the
// loop must process it before terminating; a naive loop would drop it.
//
// @evidence contracts/testing.md#behavioral-verification A final request line without a trailing newline is still processed and answered.
// @evidence contracts/testing.md#independent-expectations The reply for the unterminated line is the authored transform of the requested file.
// @evidence contracts/testing.md#distinguishing-cases Newline-terminated lines are the neighbor handled by sibling tests; the last unterminated line is the boundary a line scanner can drop.
// @evidence contracts/testing.md#execution-ownership TestUtilityServeProcessesFinalLineWithoutNewline is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
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
  if !reply.Found || strings.TrimSpace(reply.TypeScript) != "export const value: number = 1;" {
    t.Fatalf("newline-less request was not answered correctly: %q", lines[0])
  }
}
