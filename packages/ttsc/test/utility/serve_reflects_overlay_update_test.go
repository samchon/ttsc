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
  // The edit must replace, not append: the original value must be gone.
  if strings.Contains(after.TypeScript, "= 1") {
    t.Fatalf("update did not replace the original value: %q", lines[2])
  }
}

// TestUtilityServeUpdateFailureRollsBackAndRecovers verifies that an update that
// does not compile leaves the previous transform in effect (reply updated:false),
// and that the failed edit is rolled back out of the overlay so a later valid
// update to a DIFFERENT file still succeeds rather than staying wedged on the
// broken buffer.
//
// This is the load-bearing half of the update contract (samchon/ttsc#255): an
// editor sends a transient broken buffer mid-keystroke, and the resident host
// must neither crash nor corrupt the cache, and must recover on the next good
// edit. The recovery edit targets b.ts, not the broken a.ts, so it can only
// compile if a.ts's rejected buffer was rolled back; a same-file recovery would
// pass even without rollback because it overwrites the broken override.
//
// 1. Update a.ts with a type error; assert updated:false and a.ts still
//    transforms to its original value.
// 2. Update b.ts with valid content; assert updated:true, which holds only if
//    a.ts was rolled back (otherwise the rebuild still sees a.ts broken).
// 3. Transform b.ts and confirm the new value.
func TestUtilityServeUpdateFailureRollsBackAndRecovers(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "noEmit": true },
  "files": ["a.ts", "b.ts"]
}
`)
  writeProjectFile(t, root, "a.ts", `export const a: number = 1;
`)
  writeProjectFile(t, root, "b.ts", `export const b: number = 10;
`)
  aPath := filepath.Join(root, "a.ts")
  bPath := filepath.Join(root, "b.ts")

  requests := serveUpdateLine(t, aPath, "export const a: number = \"oops\";\n") + "\n" +
    serveRequestLine(t, aPath) + "\n" +
    serveUpdateLine(t, bPath, "export const b: number = 20;\n") + "\n" +
    serveRequestLine(t, bPath) + "\n"

  var out bytes.Buffer
  code := utility.RunServe(strings.NewReader(requests), &out, []string{"--cwd", root})
  if code != 0 {
    t.Fatalf("RunServe exit %d; output=%q", code, out.String())
  }

  lines := strings.Split(strings.TrimSpace(out.String()), "\n")
  if len(lines) != 4 {
    t.Fatalf("expected one reply per request, got %d: %q", len(lines), out.String())
  }

  var failed serveUpdateReply
  if err := json.Unmarshal([]byte(lines[0]), &failed); err != nil {
    t.Fatalf("decode reply 0: %v (%q)", err, lines[0])
  }
  if failed.Updated {
    t.Fatalf("expected the type-erroring update to fail: %q", lines[0])
  }

  var stale serveResponse
  if err := json.Unmarshal([]byte(lines[1]), &stale); err != nil {
    t.Fatalf("decode reply 1: %v (%q)", err, lines[1])
  }
  if !stale.Found || !strings.Contains(stale.TypeScript, "= 1") {
    t.Fatalf("failed update did not keep the previous transform: %q", lines[1])
  }

  var recovered serveUpdateReply
  if err := json.Unmarshal([]byte(lines[2]), &recovered); err != nil {
    t.Fatalf("decode reply 2: %v (%q)", err, lines[2])
  }
  if !recovered.Updated {
    t.Fatalf("a valid update to b.ts must succeed, proving a.ts was rolled back: %q", lines[2])
  }

  var after serveResponse
  if err := json.Unmarshal([]byte(lines[3]), &after); err != nil {
    t.Fatalf("decode reply 3: %v (%q)", err, lines[3])
  }
  if !after.Found || !strings.Contains(after.TypeScript, "20") {
    t.Fatalf("resident host did not reflect the recovery update: %q", lines[3])
  }
}
