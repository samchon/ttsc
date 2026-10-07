package lspserver

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestLSPCompletionMergesIntoUpstreamResponse checks three authored response shapes.
//
// A bare item array, a CompletionList and null must accept the supplied hint.
// This unit checks ordered labels and isIncomplete, then checks the label
// fallback and insertText in a null-result merge. It does not run tsgo or an
// editor, or assert preservation of every upstream item or envelope field.
//
//  1. Merge into each of the three shapes.
//  2. Assert the literal upstream and plugin label order for each shape.
//  3. Assert the supplied list's true flag and array/null false flags.
//
// @evidence contracts/testing.md#behavioral-verification Actual mergeCompletionResponse calls produce the literal ordered labels for an authored bare array, CompletionList and null result; the list's true isIncomplete survives and array/null yield false. A separate null-result call asserts the supplied Insert becomes label and insertText. Other item and envelope fields are not compared.
// @evidence contracts/testing.md#independent-expectations The expected label lists and incompleteness are literals per response shape.
// @evidence contracts/testing.md#distinguishing-cases Each of the three upstream shapes takes a different decode path, so a merge that handled only one drops items in the others.
// @evidence contracts/testing.md#execution-ownership This Go unit calls the actual package-local merge function with authored JSON bytes and one supplied item, then decodes the returned bytes. It creates no filesystem fixture, substitutes no operation and starts no compiler, process or product host; upstream response production and editor handling are outside its observations.
func TestLSPCompletionMergesIntoUpstreamResponse(t *testing.T) {
  items := []LSPCompletionItem{{Insert: "pricing", Detail: "Pricing"}}

  cases := []struct {
    name       string
    body       string
    wantLabels []string
    incomplete bool
  }{
    {
      name:       "bare array",
      body:       `{"jsonrpc":"2.0","id":1,"result":[{"label":"toString"}]}`,
      wantLabels: []string{"toString", "pricing"},
    },
    {
      name:       "completion list preserves isIncomplete",
      body:       `{"jsonrpc":"2.0","id":1,"result":{"isIncomplete":true,"items":[{"label":"toString"}]}}`,
      wantLabels: []string{"toString", "pricing"},
      incomplete: true,
    },
    {
      // A null response has no upstream item to retain.
      name:       "null result",
      body:       `{"jsonrpc":"2.0","id":1,"result":null}`,
      wantLabels: []string{"pricing"},
    },
  }
  for _, entry := range cases {
    merged := mergeCompletionResponse([]byte(entry.body), items)
    var decoded struct {
      Result struct {
        IsIncomplete bool `json:"isIncomplete"`
        Items        []struct {
          Label      string `json:"label"`
          InsertText string `json:"insertText"`
          Detail     string `json:"detail"`
        } `json:"items"`
      } `json:"result"`
    }
    if err := json.Unmarshal(merged, &decoded); err != nil {
      t.Fatalf("%s: merged body is not valid JSON: %v\n%s", entry.name, err, merged)
    }
    labels := []string{}
    for _, item := range decoded.Result.Items {
      labels = append(labels, item.Label)
    }
    if !equalStrings(labels, entry.wantLabels) {
      t.Errorf("%s: merged labels %v, want %v", entry.name, labels, entry.wantLabels)
    }
    if decoded.Result.IsIncomplete != entry.incomplete {
      t.Errorf(
        "%s: isIncomplete = %v, want %v — the flag is upstream's to own",
        entry.name, decoded.Result.IsIncomplete, entry.incomplete,
      )
    }
  }

  // A hint with no Label falls back to Insert, because the editor lists Label
  // and an empty one renders as a blank row.
  merged := mergeCompletionResponse([]byte(`{"jsonrpc":"2.0","id":1,"result":null}`), items)
  if !strings.Contains(string(merged), `"label":"pricing"`) {
    t.Errorf("an item without a Label must fall back to Insert:\n%s", merged)
  }
  if !strings.Contains(string(merged), `"insertText":"pricing"`) {
    t.Errorf("insertText must carry Insert:\n%s", merged)
  }
}

// TestLSPCompletionLeavesUpstreamErrorsAlone pins the negative twin.
//
// An upstream error is upstream's to report. Appending completions to it would
// turn a failure into a half-answer that looks like it worked, which is worse
// than the error the user was supposed to see.
//
// @evidence contracts/testing.md#behavioral-verification An upstream error response is returned byte for byte, and merging no items leaves the body unchanged.
// @evidence contracts/testing.md#independent-expectations The expected output is the input body itself.
// @evidence contracts/testing.md#distinguishing-cases An error body and an empty contribution are the two cases that must not be rewritten.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the actual package-local merge function on two authored JSON bodies and compares returned bytes to each original. It substitutes no seam and creates no directory or sidecar; no upstream compiler, editor, process or product host runs. The changing merge cases are owned by TestLSPCompletionMergesIntoUpstreamResponse.
func TestLSPCompletionLeavesUpstreamErrorsAlone(t *testing.T) {
  body := `{"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"boom"}}`
  if got := string(mergeCompletionResponse([]byte(body), []LSPCompletionItem{{Insert: "x"}})); got != body {
    t.Errorf("an upstream error was rewritten:\n%s", got)
  }

  // Nothing to add is not a reason to rewrite a body either.
  plain := `{"jsonrpc":"2.0","id":1,"result":[]}`
  if got := string(mergeCompletionResponse([]byte(plain), nil)); got != plain {
    t.Errorf("an empty contribution rewrote the body:\n%s", got)
  }
}

// TestOffsetForPositionCountsUTF16 pins the position conversion.
//
// LSP counts a position's character in UTF-16 code units, not bytes. A line
// holding an emoji or CJK text would otherwise land the cursor mid-token, and
// the line prefix — which every trigger matches against — would be cut in the
// wrong place. The failure is silent: completion just stops appearing on lines
// with non-ASCII text.
//
//  1. Convert an ASCII position.
//  2. Convert past CJK text, which is one UTF-16 unit but three bytes.
//  3. Convert past an emoji, which is a surrogate pair — two units, four bytes.
//
// @evidence contracts/testing.md#behavioral-verification offsetForPosition counts an LSP character in UTF-16 units: ASCII, CJK text (one unit, three bytes) and an emoji (two units, four bytes) all yield the right text prefix.
// @evidence contracts/testing.md#independent-expectations The expected prefixes are literal strings derived from the UTF-16 definition in the LSP specification.
// @evidence contracts/testing.md#distinguishing-cases Four positive rows cover ASCII, a second LF-separated line, two BMP CJK characters and an astral emoji; a separate line-five request on one line must fail. Surrogate-interior columns and malformed text are not exercised.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls actual offsetForPosition and compares string slices with authored literal prefixes. Its delegating lspPositionToByteOffset runs in the same process; no substitute operation, native child, temporary project, installed consumer or product host is used.
func TestOffsetForPositionCountsUTF16(t *testing.T) {
  cases := []struct {
    text      string
    line      int
    character int
    want      string
  }{
    {"abc", 0, 2, "ab"},
    {"/**\n * @evi", 1, 7, "/**\n * @evi"},
    // 가격 is two runes, two UTF-16 units, six bytes.
    {"// 가격 x", 0, 5, "// 가격"},
    // An emoji past the BMP costs two units.
    {"// 🚀 x", 0, 5, "// 🚀"},
  }
  for _, entry := range cases {
    offset, ok := offsetForPosition(entry.text, entry.line, entry.character)
    if !ok {
      t.Errorf("offsetForPosition(%q, %d, %d) failed", entry.text, entry.line, entry.character)
      continue
    }
    if got := entry.text[:offset]; got != entry.want {
      t.Errorf(
        "offsetForPosition(%q, %d, %d) cut at %q, want %q",
        entry.text, entry.line, entry.character, got, entry.want,
      )
    }
  }

  if _, ok := offsetForPosition("one line", 5, 0); ok {
    t.Error("a line past the end must fail rather than clamp silently")
  }
}
