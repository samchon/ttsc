package ttsc_test

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// serveUpdateReply mirrors the JSON reply RunServe writes for an update request.
type serveUpdateReply struct {
  Updated bool `json:"updated"`
}

// serveUpdateLine encodes one resident-host update request line.
func serveUpdateLine(t *testing.T, file, content string) string {
  t.Helper()
  data, err := json.Marshal(map[string]string{"content": content, "update": file})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// TestUtilityServeReflectsOverlayUpdate verifies the resident serve host applies
// an in-memory edit and re-transforms, so a later transform request returns the
// edited content without restarting the host.
//
// This is the incremental half of the resident host (samchon/ttsc#255): an
// editor or watch consumer feeds an unsaved buffer through an update request and
// the next transform must reflect it. The host keys the overlay so the edit
// shadows the on-disk file, rebuilds the transform over the new content, and
// keeps serving from the warm process.
//
// 1. Transform index.ts and confirm the original value.
// 2. Update index.ts with new content and confirm the rebuild succeeded.
// 3. Transform index.ts again and confirm the edited value is returned.
func TestUtilityServeReflectsOverlayUpdate(t *testing.T) {
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
    serveUpdateLine(t, index, "export const value: number = 2;\n") + "\n" +
    serveRequestLine(t, index) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 3 {
    t.Fatalf("expected one reply per request, got %d: %q", len(lines), out.String())
  }

  var before serveResponse
  if err := json.Unmarshal([]byte(lines[0]), &before); err != nil {
    t.Fatalf("decode reply 0: %v (%q)", err, lines[0])
  }
  if !before.Found || !strings.Contains(before.TypeScript, "1") {
    t.Fatalf("initial transform did not return the original value: %q", lines[0])
  }

  var updated serveUpdateReply
  if err := json.Unmarshal([]byte(lines[1]), &updated); err != nil {
    t.Fatalf("decode reply 1: %v (%q)", err, lines[1])
  }
  if !updated.Updated {
    t.Fatalf("expected the overlay update to rebuild successfully: %q", lines[1])
  }

  var after serveResponse
  if err := json.Unmarshal([]byte(lines[2]), &after); err != nil {
    t.Fatalf("decode reply 2: %v (%q)", err, lines[2])
  }
  if !after.Found || !strings.Contains(after.TypeScript, "2") {
    t.Fatalf("resident host did not reflect the overlay update: %q", lines[2])
  }
}
