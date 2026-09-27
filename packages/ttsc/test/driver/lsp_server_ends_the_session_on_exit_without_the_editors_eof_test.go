package driver_test

import (
  "context"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerEndsTheSessionOnExitWithoutTheEditorsEOF pins that the LSP
// `exit` notification ends the session while the editor's stream stays open.
//
// The specification has `exit` ask the server to exit its process, and plain
// tsgo does. The proxy waited for the editor's stream to close as well, and a
// read blocked on the editor's stdin is not interrupted by closing it on every
// platform (a Windows pipe is not), so ttscserver kept running after `exit`
// until the editor happened to close the pipe (samchon/ttsc#1575). The editor
// input here cannot be closed at all, as that stdin cannot be interrupted.
//
//  1. Give RunLSPServer an editor input that never ends and has no Close, and
//     an upstream that answers `shutdown` and returns on `exit`, as tsgo does.
//  2. Send `shutdown`, then `exit`, and keep the input open.
//  3. Assert RunLSPServer returns nil promptly and the editor got the
//     `shutdown` response.
func TestLSPServerEndsTheSessionOnExitWithoutTheEditorsEOF(t *testing.T) {
  editorInR, editorInW := io.Pipe()
  defer editorInW.Close()
  editorOutR, editorOutW := io.Pipe()
  defer editorOutW.Close()
  answered := make(chan string, 1)
  go func() {
    fr := driver.NewFrameReader(editorOutR)
    for {
      _, body, err := fr.Read()
      if err != nil {
        return
      }
      env, parseErr := driver.ParseEnvelope(body)
      if parseErr == nil && env.IsResponse() {
        answered <- env.IDKey()
      }
    }
  }()

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:       uncloseableReader{editorInR},
      Out:      editorOutW,
      Err:      io.Discard,
      Cwd:      t.TempDir(),
      Upstream: driver.LSPUpstream{Runner: tsgoLikeUpstream},
    })
  }()

  for _, frame := range []string{
    `{"jsonrpc":"2.0","id":1,"method":"shutdown"}`,
    `{"jsonrpc":"2.0","method":"exit"}`,
  } {
    if err := driver.WriteFrame(editorInW, []byte(frame)); err != nil {
      t.Fatal(err)
    }
  }

  select {
  case err := <-done:
    if err != nil {
      t.Fatalf("exit after shutdown must end the session cleanly: %v", err)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("RunLSPServer kept running after exit while the editor's stream stayed open")
  }
  select {
  case id := <-answered:
    if id == "" {
      t.Fatal("the shutdown response carried no id")
    }
  case <-time.After(5 * time.Second):
    t.Fatal("the editor never received the shutdown response")
  }
}
