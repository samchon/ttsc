//go:build js && wasm

package host_test

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "syscall/js"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/wasm/host"
)

const fountainPositionAPI = "ttscFountainPositionTest"

type fountainNode struct {
  KindName string `json:"kindName"`
  Text     string `json:"text"`
}

type fountainType struct {
  Text string `json:"text"`
}

type fountainSymbol struct {
  Name string `json:"name"`
}

// TestFountainPositionVerbsResolveTouchingTokens exercises the public wasm
// API against a real Program. It guards the token-level cursor contract from
// declarations through references, literals, punctuation, trivia, UTF-8 byte
// offsets, position errors, and release lifecycle errors.
func TestFountainPositionVerbsResolveTouchingTokens(t *testing.T) {
  api := startFountainAPI(t)
  root := os.Getenv("TTSC_WASM_TEST_ROOT")
  if root == "" || !filepath.IsAbs(root) {
    t.Fatalf("TTSC_WASM_TEST_ROOT must be an absolute wasm path, got %q", root)
  }
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), []byte(`{"compilerOptions":{"strict":true},"files":["src/index.ts"]}`), 0o644); err != nil {
    t.Fatal(err)
  }
  const source = `type Point = { x: number };
const recordValue: Point = { x: 1 };
const copy = recordValue;
const text = "ok";
const café = recordValue; // trailing comment
`
  if err := os.WriteFile(filepath.Join(root, "src", "index.ts"), []byte(source), 0o644); err != nil {
    t.Fatal(err)
  }
  code, result := callFountain(t, api, "snapshot", map[string]any{"cwd": root})
  if code != 0 {
    t.Fatalf("snapshot failed: %s", result)
  }
  var snapshot struct {
    Handle string `json:"handle"`
  }
  if err := json.Unmarshal([]byte(result), &snapshot); err != nil {
    t.Fatal(err)
  }
  if snapshot.Handle == "" {
    t.Fatal("snapshot returned no handle")
  }

  query := func(verb string, position int) json.RawMessage {
    t.Helper()
    code, result := callFountain(t, api, verb, map[string]any{
      "handle":   snapshot.Handle,
      "path":     "src/index.ts",
      "position": position,
    })
    if code != 0 {
      t.Fatalf("%s(%d) failed: %s", verb, position, result)
    }
    return json.RawMessage(result)
  }

  assertNode(t, query("getNodeAtPosition", nthIndex(t, source, "recordValue", 1)), "KindIdentifier", "recordValue")
  assertSymbol(t, query("getSymbolAtPosition", nthIndex(t, source, "recordValue", 1)), "recordValue")
  assertType(t, query("getTypeAtPosition", nthIndex(t, source, "recordValue", 1)), "Point")

  assertNode(t, query("getNodeAtPosition", nthIndex(t, source, "recordValue", 2)), "KindIdentifier", "recordValue")
  assertSymbol(t, query("getSymbolAtPosition", nthIndex(t, source, "recordValue", 2)), "recordValue")
  assertType(t, query("getTypeAtPosition", nthIndex(t, source, "recordValue", 2)), "Point")

  assertNode(t, query("getNodeAtPosition", nthIndex(t, source, "Point", 2)), "KindIdentifier", "Point")
  assertSymbol(t, query("getSymbolAtPosition", nthIndex(t, source, "Point", 2)), "Point")
  assertType(t, query("getTypeAtPosition", nthIndex(t, source, "Point", 2)), "Point")

  assertNode(t, query("getNodeAtPosition", strings.Index(source, "1 }")), "KindNumericLiteral", "1")
  assertType(t, query("getTypeAtPosition", strings.Index(source, "1 }")), "number")
  assertNode(t, query("getNodeAtPosition", strings.Index(source, "\"ok\"")), "KindStringLiteral", "\"ok\"")
  assertType(t, query("getTypeAtPosition", strings.Index(source, "\"ok\"")), "\"ok\"")

  cafe := strings.Index(source, "café")
  assertNode(t, query("getNodeAtPosition", cafe), "KindIdentifier", "café")
  assertNode(t, query("getNodeAtPosition", cafe+len("caf")+1), "KindIdentifier", "café")
  assertSymbol(t, query("getSymbolAtPosition", cafe), "café")
  assertType(t, query("getTypeAtPosition", cafe), "Point")

  semicolon := strings.Index(source, ";")
  assertNode(t, query("getNodeAtPosition", semicolon), "KindSemicolonToken", ";")
  assertNull(t, query("getTypeAtPosition", semicolon), "type")
  assertNull(t, query("getSymbolAtPosition", semicolon), "symbol")

  whitespace := strings.Index(source, "const recordValue") + len("const")
  assertNull(t, query("getNodeAtPosition", whitespace), "node")
  assertNull(t, query("getTypeAtPosition", whitespace), "type")
  assertNull(t, query("getSymbolAtPosition", whitespace), "symbol")

  comment := strings.Index(source, "trailing")
  assertNull(t, query("getNodeAtPosition", comment), "node")
  assertNull(t, query("getTypeAtPosition", comment), "type")
  assertNull(t, query("getSymbolAtPosition", comment), "symbol")

  for _, pos := range []int{-1, len(source), len(source) + 1} {
    code, result := callFountain(t, api, "getNodeAtPosition", map[string]any{
      "handle":   snapshot.Handle,
      "path":     "src/index.ts",
      "position": pos,
    })
    if code != 2 {
      t.Fatalf("position %d returned code %d: %s", pos, code, result)
    }
  }

  code, result = callFountain(t, api, "releaseSnapshot", map[string]any{"handle": snapshot.Handle})
  if code != 0 {
    t.Fatalf("releaseSnapshot failed: %s", result)
  }
  code, result = callFountain(t, api, "getNodeAtPosition", map[string]any{
    "handle":   snapshot.Handle,
    "path":     "src/index.ts",
    "position": 0,
  })
  if code != 2 {
    t.Fatalf("released snapshot query returned code %d: %s", code, result)
  }
}

func startFountainAPI(t *testing.T) js.Value {
  t.Helper()
  go host.Expose(fountainPositionAPI, host.Config{})
  deadline := time.Now().Add(30 * time.Second)
  for time.Now().Before(deadline) {
    api := js.Global().Get(fountainPositionAPI)
    if api.Type() == js.TypeObject {
      return api
    }
    time.Sleep(time.Millisecond)
  }
  t.Fatalf("%s did not become available", fountainPositionAPI)
  return js.Undefined()
}

func callFountain(t *testing.T, api js.Value, verb string, opts map[string]any) (int, string) {
  t.Helper()
  value := awaitPromise(t, api.Call(verb, js.ValueOf(opts)))
  code := value.Get("code").Int()
  result := value.Get("result").String()
  if code != 0 {
    return code, fmt.Sprintf("%s (stderr: %s)", result, value.Get("stderr").String())
  }
  return code, result
}

func awaitPromise(t *testing.T, promise js.Value) js.Value {
  t.Helper()
  fulfilled := make(chan js.Value, 1)
  rejected := make(chan js.Value, 1)
  resolve := js.FuncOf(func(this js.Value, args []js.Value) any {
    fulfilled <- args[0]
    return nil
  })
  reject := js.FuncOf(func(this js.Value, args []js.Value) any {
    rejected <- args[0]
    return nil
  })
  defer resolve.Release()
  defer reject.Release()
  promise.Call("then", resolve).Call("catch", reject)
  select {
  case value := <-fulfilled:
    return value
  case reason := <-rejected:
    t.Fatalf("fountain promise rejected: %s", reason.String())
  case <-time.After(30 * time.Second):
    t.Fatal("fountain promise timed out")
  }
  return js.Undefined()
}

func nthIndex(t *testing.T, text, needle string, n int) int {
  t.Helper()
  start := 0
  for occurrence := 0; occurrence < n; occurrence++ {
    i := strings.Index(text[start:], needle)
    if i < 0 {
      t.Fatalf("%q occurrence %d not found", needle, n)
    }
    start += i
    if occurrence == n-1 {
      return start
    }
    start += len(needle)
  }
  t.Fatal("unreachable")
  return 0
}

func assertNode(t *testing.T, result json.RawMessage, kind, text string) {
  t.Helper()
  var payload struct {
    Node *fountainNode `json:"node"`
  }
  if err := json.Unmarshal(result, &payload); err != nil {
    t.Fatal(err)
  }
  if payload.Node == nil {
    t.Fatal("node is null")
  }
  if payload.Node.KindName != kind || payload.Node.Text != text {
    t.Fatalf("node = %#v, want kind=%q text=%q", payload.Node, kind, text)
  }
}

func assertType(t *testing.T, result json.RawMessage, text string) {
  t.Helper()
  var payload struct {
    Type *fountainType `json:"type"`
  }
  if err := json.Unmarshal(result, &payload); err != nil {
    t.Fatal(err)
  }
  if payload.Type == nil || payload.Type.Text != text {
    t.Fatalf("type = %#v, want %q", payload.Type, text)
  }
}

func assertSymbol(t *testing.T, result json.RawMessage, name string) {
  t.Helper()
  var payload struct {
    Symbol *fountainSymbol `json:"symbol"`
  }
  if err := json.Unmarshal(result, &payload); err != nil {
    t.Fatal(err)
  }
  if payload.Symbol == nil || payload.Symbol.Name != name {
    t.Fatalf("symbol = %#v, want %q", payload.Symbol, name)
  }
}

func assertNull(t *testing.T, result json.RawMessage, field string) {
  t.Helper()
  var payload map[string]json.RawMessage
  if err := json.Unmarshal(result, &payload); err != nil {
    t.Fatal(err)
  }
  if value, ok := payload[field]; !ok || string(value) != "null" {
    t.Fatalf("%s = %s, want null", field, value)
  }
}

func (node fountainNode) String() string {
  return fmt.Sprintf("%s(%q)", node.KindName, node.Text)
}
