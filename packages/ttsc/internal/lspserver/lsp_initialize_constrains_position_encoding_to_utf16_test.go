package lspserver

import (
  "bytes"
  "encoding/json"
  "errors"
  "io"
  "testing"
)

// TestLSPInitializeConstrainsPositionEncodingToUTF16 verifies that the offer
// forwarded to tsgo can only ever select UTF-16, and that a client which did not
// offer UTF-8 reaches tsgo byte for byte as before.
//
// LSP 3.17 negotiates one PositionEncodingKind per session. The pinned
// typescript-go selects `utf-8` whenever a client offers it and advertises that
// choice back through the proxy, while every position ttsc computes itself — the
// incremental buffer cache, plugin completion, the lint sidecar's ranges, the
// graph symbol provider — counts UTF-16 code units. ttscserver therefore settles
// the negotiation at the initialize request instead of tracking it, so the two
// halves of one editor response cannot disagree.
//
//  1. Forward an initialize request offering UTF-8 first and assert the upstream
//     frame offers UTF-16 alone while every sibling field survives verbatim.
//  2. Assert an offer of UTF-16 alone, an absent offer, and a non-initialize
//     envelope are returned unchanged.
//  3. Drive the real editor-to-upstream pump and assert the rewrite is what tsgo
//     actually receives.
func TestLSPInitializeConstrainsPositionEncodingToUTF16(t *testing.T) {
  const offeringUTF8 = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"processId":4242,"rootUri":"file:///project","capabilities":` +
    `{"general":{"markdown":{"parser":"marked"},"positionEncodings":["utf-8","utf-16"]},` +
    `"textDocument":{"completion":{"dynamicRegistration":true}}}}}`

  rewritten := constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF8), []byte(offeringUTF8))
  assertPositionEncodings(t, rewritten, []string{positionEncodingUTF16})
  assertInitializeSiblingsSurvive(t, rewritten)

  const offeringUTF8Only = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"capabilities":{"general":{"positionEncodings":["utf-8"]}}}}`
  assertPositionEncodings(
    t,
    constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF8Only), []byte(offeringUTF8Only)),
    []string{positionEncodingUTF16},
  )

  const offeringUTF32 = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"capabilities":{"general":{"positionEncodings":["utf-32","utf-8"]}}}}`
  assertPositionEncodings(
    t,
    constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF32), []byte(offeringUTF32)),
    []string{positionEncodingUTF16},
  )

  // Negative twins: a client that never offered UTF-8 must reach tsgo exactly as
  // it wrote its request, so no existing session changes shape.
  unchanged := []struct {
    name string
    body string
  }{
    {
      name: "utf-16 alone is already the settlement",
      body: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
        `{"capabilities":{"general":{"positionEncodings":["utf-16"]}}}}`,
    },
    {
      name: "no offer means the LSP default",
      body: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
        `{"capabilities":{"general":{"markdown":{"parser":"marked"}}}}}`,
    },
    {
      name: "no general capabilities at all",
      body: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`,
    },
    {
      name: "a later request is never rewritten",
      body: `{"jsonrpc":"2.0","id":2,"method":"textDocument/completion","params":` +
        `{"capabilities":{"general":{"positionEncodings":["utf-8"]}}}}`,
    },
    {
      name: "an initialized notification is not the initialize request",
      body: `{"jsonrpc":"2.0","method":"initialize","params":` +
        `{"capabilities":{"general":{"positionEncodings":["utf-8"]}}}}`,
    },
  }
  for _, testCase := range unchanged {
    t.Run(testCase.name, func(t *testing.T) {
      got := constrainInitializePositionEncoding(
        mustParseEnvelope(t, testCase.body),
        []byte(testCase.body),
      )
      if !bytes.Equal(got, []byte(testCase.body)) {
        t.Errorf("forwarded frame was rewritten:\n got %s\nwant %s", got, testCase.body)
      }
    })
  }

  // The helper is only correct if it sits on the forwarding path, so drive the
  // real pump and read what tsgo would have received.
  var editorIn bytes.Buffer
  if err := WriteFrame(&editorIn, []byte(offeringUTF8)); err != nil {
    t.Fatalf("write editor frame: %v", err)
  }
  var upstream bytes.Buffer
  proxy := NewProxy(ProxyOptions{
    EditorIn:   &editorIn,
    EditorOut:  io.Discard,
    UpstreamIn: &upstream,
  })
  if err := proxy.pumpEditorToUpstream(t.Context()); !errors.Is(err, ErrFrameClosed) {
    t.Fatalf("pump editor to upstream: %v", err)
  }
  _, forwarded, err := NewFrameReader(bytes.NewReader(upstream.Bytes())).Read()
  if err != nil {
    t.Fatalf("read forwarded initialize: %v", err)
  }
  assertPositionEncodings(t, forwarded, []string{positionEncodingUTF16})
}

func mustParseEnvelope(t *testing.T, body string) Envelope {
  t.Helper()
  env, err := ParseEnvelope([]byte(body))
  if err != nil {
    t.Fatalf("parse envelope %s: %v", body, err)
  }
  return env
}

func assertPositionEncodings(t *testing.T, body []byte, want []string) {
  t.Helper()
  var decoded struct {
    Params struct {
      Capabilities struct {
        General struct {
          PositionEncodings []string `json:"positionEncodings"`
        } `json:"general"`
      } `json:"capabilities"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("decode forwarded initialize: %v\n%s", err, body)
  }
  got := decoded.Params.Capabilities.General.PositionEncodings
  if len(got) != len(want) {
    t.Fatalf("positionEncodings = %v, want %v", got, want)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("positionEncodings = %v, want %v", got, want)
    }
  }
}

func assertInitializeSiblingsSurvive(t *testing.T, body []byte) {
  t.Helper()
  var decoded struct {
    ID     json.RawMessage `json:"id"`
    Method string          `json:"method"`
    Params struct {
      ProcessID    int    `json:"processId"`
      RootURI      string `json:"rootUri"`
      Capabilities struct {
        General struct {
          Markdown struct {
            Parser string `json:"parser"`
          } `json:"markdown"`
        } `json:"general"`
        TextDocument struct {
          Completion struct {
            DynamicRegistration bool `json:"dynamicRegistration"`
          } `json:"completion"`
        } `json:"textDocument"`
      } `json:"capabilities"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("decode rewritten initialize: %v\n%s", err, body)
  }
  if string(decoded.ID) != "1" || decoded.Method != methodInitialize {
    t.Errorf("envelope identity changed: id=%s method=%q", decoded.ID, decoded.Method)
  }
  if decoded.Params.ProcessID != 4242 {
    t.Errorf("processId = %d, want 4242 (re-encoded, not preserved)", decoded.Params.ProcessID)
  }
  if decoded.Params.RootURI != "file:///project" {
    t.Errorf("rootUri = %q, want file:///project", decoded.Params.RootURI)
  }
  if decoded.Params.Capabilities.General.Markdown.Parser != "marked" {
    t.Errorf("general.markdown.parser = %q, want marked",
      decoded.Params.Capabilities.General.Markdown.Parser)
  }
  if !decoded.Params.Capabilities.TextDocument.Completion.DynamicRegistration {
    t.Error("textDocument.completion.dynamicRegistration was dropped")
  }
}
