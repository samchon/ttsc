package lspserver

import (
  "bytes"
  "encoding/json"
  "errors"
  "io"
  "testing"
  "time"
)

// TestLSPInitializeConstrainsPositionEncodingToUTF16 checks authored offer
// rewrites, selected sibling values, pass-through bytes and a buffered pump.
//
// Three explicit non-UTF16 offers are rewritten to the UTF16 singleton; seven
// authored already-default/non-request cases retain their original bytes.
// The actual editor pump writes a constrained frame to a bytes.Buffer, not to
// an executing tsgo process. This does not certify every downstream position
// consumer, an actual negotiated session or all sibling fields/byte spelling.
// A separate empty-stream group owns pre-initialize EOF, unchanged empty
// editor output, nil proxy result and actual in-process upstream input closure.
// Its bounded wait is a test failure guard, not a product close deadline.
//
//  1. Forward an initialize request offering UTF-8 first and assert the upstream
//     frame offers UTF-16 alone while selected decoded sibling values survive.
//  2. Assert an offer of UTF-16 alone, an absent offer, and a non-initialize
//     envelope are returned unchanged.
//  3. Drive the actual buffered pump and assert the emitted offer is UTF-16.
//
// @evidence contracts/testing.md#behavioral-verification Actual constrainInitializePositionEncoding rewrites three authored offers to the literal UTF16 singleton, preserves selected decoded sibling values and returns seven quiet-case bodies byte for byte. The framed pump emits UTF16 and returns ErrFrameClosed. Actual Proxy.Run before initialize returns nil with empty editor bytes and closes the owned upstream io.Pipe writer so its reader observes EOF; no upstream process consumes bytes here.
// @evidence contracts/testing.md#independent-expectations Expected offer values, selected sibling values and EOF sentinel are independent literals; pass-through cases compare to their original authored bytes. Rewritten-frame byte identity and unlisted sibling fields are not asserted.
// @evidence contracts/testing.md#distinguishing-cases UTF8+UTF16, UTF8-only and UTF32+UTF8 offers change; UTF16-only, missing/null/empty offer, missing general capabilities, another method and an initialize notification pass through. Shared branches are not claimed as ten distinct algorithms.
// @evidence contracts/testing.md#execution-ownership This Go unit directly invokes the actual constraint and actual framed editor-to-upstream pump through supported streams, then decodes returned frames. The empty-stream group runs actual Proxy.Run with owned io.Pipe endpoints and no supplied peer responses to verify EOF closure/returned nil; it authenticates no OS child or initialized server. No compiler, native process, installed consumer, product host or editor runs.
func TestLSPInitializeConstrainsPositionEncodingToUTF16(t *testing.T) {
  const offeringUTF8 = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"processId":4242,"rootUri":"file:///project","capabilities":` +
    `{"general":{"markdown":{"parser":"marked"},"positionEncodings":["utf-8","utf-16"]},` +
    `"textDocument":{"completion":{"dynamicRegistration":true}}}}}`

  rewritten := constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF8), []byte(offeringUTF8))
  assertPositionEncodings(t, rewritten, []string{"utf-16"})
  assertInitializeSiblingsSurvive(t, rewritten)

  const offeringUTF8Only = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"capabilities":{"general":{"positionEncodings":["utf-8"]}}}}`
  assertPositionEncodings(
    t,
    constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF8Only), []byte(offeringUTF8Only)),
    []string{"utf-16"},
  )

  const offeringUTF32 = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
    `{"capabilities":{"general":{"positionEncodings":["utf-32","utf-8"]}}}}`
  assertPositionEncodings(
    t,
    constrainInitializePositionEncoding(mustParseEnvelope(t, offeringUTF32), []byte(offeringUTF32)),
    []string{"utf-16"},
  )

  // These authored default/non-request cases keep their original bytes.
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
      name: "an empty offer already means the LSP default",
      body: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
        `{"capabilities":{"general":{"positionEncodings":[]}}}}`,
    },
    {
      name: "a null offer already means the LSP default",
      body: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":` +
        `{"capabilities":{"general":{"positionEncodings":null}}}}`,
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

  // Drive the actual forwarding pump with buffers and inspect its output frame.
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
  assertPositionEncodings(t, forwarded, []string{"utf-16"})
  t.Run("uninitialized_empty_stream_closes_upstream_input", func(t *testing.T) {
    upstreamRead, upstreamWrite := io.Pipe()
    t.Cleanup(func() { upstreamWrite.Close(); upstreamRead.Close() })
    var editorOut bytes.Buffer
    emptyProxy := NewProxy(ProxyOptions{
      EditorIn: bytes.NewReader(nil), EditorOut: &editorOut,
      UpstreamIn: upstreamWrite, UpstreamOut: bytes.NewReader(nil),
    })
    if err := emptyProxy.Run(t.Context()); err != nil { t.Fatalf("empty stream result = %v", err) }
    if editorOut.Len() != 0 { t.Fatalf("empty stream invented editor bytes: %q", editorOut.Bytes()) }
    closed := make(chan error, 1)
    go func() { var one [1]byte; n, err := upstreamRead.Read(one[:]); if n != 0 { closed <- errors.New("empty stream wrote upstream bytes"); return }; closed <- err }()
    select {
    case err := <-closed:
      if !errors.Is(err, io.EOF) { t.Fatalf("upstream input closure = %v", err) }
    case <-time.After(2*time.Second):
      t.Fatal("empty editor EOF did not close its upstream input")
    }
  })
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
