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
)

type fountainNode struct {
  KindName string `json:"kindName"`
  Text     string `json:"text"`
  Pos      int    `json:"pos"`
  End      int    `json:"end"`
}

type fountainType struct {
  Text string `json:"text"`
}

type fountainSymbol struct {
  Name         string `json:"name"`
  Declarations []struct {
    Pos int `json:"pos"`
    End int `json:"end"`
  } `json:"declarations"`
}

// TestFountainPositionVerbsResolveTouchingTokens exercises the public wasm
// API against a real Program. It guards the token-level cursor contract from
// declarations through references, literals, punctuation, trivia, UTF-8 byte
// offsets, position errors, and release lifecycle errors.
//
// @evidence contracts/testing.md#behavioral-verification Calls the public snapshot, getNodeAtPosition, getTypeAtPosition, getSymbolAtPosition and releaseSnapshot verbs of a real js/wasm Program and asserts kind, text, token span, symbol name, declaration start and printed type for each probed position, so a verb that returns a neighbouring token, a full start including trivia or no answer fails.
// @evidence contracts/testing.md#independent-expectations The expected kinds, texts and offsets follow the authored source: strings.Index of each literal gives the byte offset the contract names, multi-byte cafe checks that offsets are bytes, and the printed types Point, number and "ok" are what TypeScript specifies for those expressions.
// @evidence contracts/testing.md#distinguishing-cases Identifiers at a declaration and a reference, numeric and string literals, a semicolon, a keyword preceded by a JSDoc comment, whitespace, a trailing comment, offsets -1 and past the end of the file, and a released handle are separate cases; punctuation and trivia must answer null and bad offsets must answer code 2.
// @evidence contracts/testing.md#execution-ownership Runs in the js/wasm test binary against the Program that the shared host.Expose API loads through the Node file system, so the connection between the JS verbs, the Go handlers and the compiler is exercised; portable Go helpers have no separate unit because they cannot run without a Program.
func TestFountainPositionVerbsResolveTouchingTokens(t *testing.T) {
  api := startSharedAPI(t)
  // A host whose temporary directory is not a usable wasm path (a Windows
  // drive path, for one) names the project root itself.
  root := os.Getenv("TTSC_WASM_TEST_ROOT")
  if root == "" {
    root = t.TempDir()
  }
  if !filepath.IsAbs(root) {
    t.Fatalf("the project root must be an absolute wasm path, got %q", root)
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
/** lead */ type Alias = Point;
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

  // pos is the token start, not the full start that includes leading trivia.
  recordValue := nthIndex(t, source, "recordValue", 1)
  assertSpan(t, query("getNodeAtPosition", recordValue), recordValue, recordValue+len("recordValue"))
  literal := strings.Index(source, "\"ok\"")
  assertSpan(t, query("getNodeAtPosition", literal), literal, literal+len("\"ok\""))
  typeKeyword := strings.Index(source, "type Alias")
  assertNode(t, query("getNodeAtPosition", typeKeyword), "KindTypeKeyword", "type")
  assertSpan(t, query("getNodeAtPosition", typeKeyword), typeKeyword, typeKeyword+len("type"))
  alias := strings.Index(source, "Alias")
  assertDeclarationStart(t, query("getSymbolAtPosition", alias), "Alias", typeKeyword)

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

func assertSpan(t *testing.T, result json.RawMessage, pos, end int) {
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
  if payload.Node.Pos != pos || payload.Node.End != end {
    t.Fatalf("node span = [%d,%d), want [%d,%d)", payload.Node.Pos, payload.Node.End, pos, end)
  }
}

func assertDeclarationStart(t *testing.T, result json.RawMessage, name string, pos int) {
  t.Helper()
  var payload struct {
    Symbol *fountainSymbol `json:"symbol"`
  }
  if err := json.Unmarshal(result, &payload); err != nil {
    t.Fatal(err)
  }
  if payload.Symbol == nil || payload.Symbol.Name != name || len(payload.Symbol.Declarations) != 1 {
    t.Fatalf("symbol = %#v, want one declaration of %q", payload.Symbol, name)
  }
  if got := payload.Symbol.Declarations[0].Pos; got != pos {
    t.Fatalf("declaration starts at %d, want the declaration keyword at %d", got, pos)
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
