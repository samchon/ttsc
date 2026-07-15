package driver_test

import (
  "context"
  "encoding/json"
  "fmt"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type lspInvocationHarness struct {
  cancel context.CancelFunc
  done   chan error
  input  *io.PipeWriter
  output *driver.FrameReader
  close  func()
}

// TestLSPServerIsolatesConcurrentUpstreams verifies each server captures its
// own runner and validation policy.
//
// The old package-global test seam allowed overlapping servers to replace each
// other's runner between validation and execution. Two concurrent invocations
// must instead keep their dependency pair and lifecycle independent, including
// after one invocation closes.
//
// 1. Start two servers with distinct validators and tagged fake runners.
// 2. Exchange one request with each server and assert each runner answers it.
// 3. Close server A, then prove server B still uses runner B for another request.
func TestLSPServerIsolatesConcurrentUpstreams(t *testing.T) {
  events := make(chan string, 4)
  cwdA := t.TempDir()
  cwdB := t.TempDir()

  start := func(tag, cwd string) *lspInvocationHarness {
    editorInR, editorInW := io.Pipe()
    editorOutR, editorOutW := io.Pipe()
    ctx, cancel := context.WithCancel(context.Background())
    done := make(chan error, 1)

    validate := func(opts driver.LSPServerOptions) error {
      if opts.Cwd != cwd {
        return fmt.Errorf("validator %s received cwd %q, want %q", tag, opts.Cwd, cwd)
      }
      events <- "validate:" + tag
      return nil
    }
    runner := func(_ context.Context, in io.Reader, out io.Writer, opts driver.LSPServerOptions) error {
      if opts.Cwd != cwd {
        return fmt.Errorf("runner %s received cwd %q, want %q", tag, opts.Cwd, cwd)
      }
      events <- "run:" + tag
      reader := driver.NewFrameReader(in)
      for {
        _, body, err := reader.Read()
        if err != nil {
          return err
        }
        var request struct {
          ID json.RawMessage `json:"id"`
        }
        if err := json.Unmarshal(body, &request); err != nil {
          return err
        }
        response, err := json.Marshal(struct {
          JSONRPC string          `json:"jsonrpc"`
          ID      json.RawMessage `json:"id"`
          Result  string          `json:"result"`
        }{
          JSONRPC: "2.0",
          ID:      request.ID,
          Result:  tag,
        })
        if err != nil {
          return err
        }
        if err := driver.WriteFrame(out, response); err != nil {
          return err
        }
      }
    }

    go func() {
      done <- driver.RunLSPServer(ctx, driver.LSPServerOptions{
        In:  editorInR,
        Out: editorOutW,
        Err: io.Discard,
        Cwd: cwd,
        Upstream: driver.LSPUpstream{
          Runner:    runner,
          Validator: validate,
        },
      })
    }()

    return &lspInvocationHarness{
      cancel: cancel,
      done:   done,
      input:  editorInW,
      output: driver.NewFrameReader(editorOutR),
      close: func() {
        cancel()
        _ = editorInW.Close()
        _ = editorOutR.Close()
      },
    }
  }

  serverA := start("A", cwdA)
  serverB := start("B", cwdB)

  observed := map[string]bool{}
  for len(observed) != 4 {
    select {
    case event := <-events:
      observed[event] = true
    case <-time.After(3 * time.Second):
      t.Fatalf("upstreams did not start; observed=%v", observed)
    }
  }
  for _, expected := range []string{"validate:A", "run:A", "validate:B", "run:B"} {
    if !observed[expected] {
      t.Fatalf("missing invocation event %q; observed=%v", expected, observed)
    }
  }

  exchange := func(server *lspInvocationHarness, id int, expected string) {
    request, err := json.Marshal(struct {
      JSONRPC string `json:"jsonrpc"`
      ID      int    `json:"id"`
      Method  string `json:"method"`
    }{JSONRPC: "2.0", ID: id, Method: "test/ping"})
    if err != nil {
      t.Fatal(err)
    }
    if err := driver.WriteFrame(server.input, request); err != nil {
      t.Fatal(err)
    }

    response := make(chan []byte, 1)
    readErr := make(chan error, 1)
    go func() {
      _, body, err := server.output.Read()
      if err != nil {
        readErr <- err
        return
      }
      response <- body
    }()

    select {
    case body := <-response:
      var envelope struct {
        ID     int    `json:"id"`
        Result string `json:"result"`
      }
      if err := json.Unmarshal(body, &envelope); err != nil {
        t.Fatal(err)
      }
      if envelope.ID != id || envelope.Result != expected {
        t.Fatalf("response mismatch: id=%d result=%q, want id=%d result=%q", envelope.ID, envelope.Result, id, expected)
      }
    case err := <-readErr:
      t.Fatal(err)
    case <-time.After(3 * time.Second):
      t.Fatalf("server %s did not answer request %d", expected, id)
    }
  }

  exchange(serverA, 1, "A")
  exchange(serverB, 2, "B")

  serverA.close()
  select {
  case err := <-serverA.done:
    if err != nil {
      t.Fatalf("server A did not close cleanly: %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("server A did not close")
  }

  exchange(serverB, 3, "B")
  serverB.close()
  select {
  case err := <-serverB.done:
    if err != nil {
      t.Fatalf("server B did not close cleanly: %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("server B did not close")
  }
}
