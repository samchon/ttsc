package driver_test

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerDefaultRunnerConstructsRealServer exercises the production
// path where defaultUpstreamRunner starts a real `tsgo --lsp --stdio` process and
// drives a minimal initialize round-trip through the proxy. Booting the
// stack and immediately cancelling would still pass if the process never
// answered; sending initialize forces the upstream LSP server to prove it
// is really running behind the proxy.
//
// 1. Call RunLSPServer with a temp directory as Cwd (no runner override).
// 2. Send a real initialize request.
// 3. Read the response and assert it carries server capabilities.
// 4. Cancel + close editor pipes; assert RunLSPServer returns nil.
func TestLSPServerDefaultRunnerConstructsRealServer(t *testing.T) {
	editorInR, editorInW := io.Pipe()
	editorOutR, editorOutW := io.Pipe()
	defer editorInR.Close()
	defer editorOutW.Close()

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- driver.RunLSPServer(ctx, driver.LSPServerOptions{
			In:         editorInR,
			Out:        editorOutW,
			Err:        io.Discard,
			Cwd:        t.TempDir(),
			TsgoBinary: tsgoBinaryForTest(t),
		})
	}()

	initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}`)
	if err := driver.WriteFrame(editorInW, initialize); err != nil {
		t.Fatal(err)
	}

	type readResult struct {
		body []byte
		err  error
	}
	reader := driver.NewFrameReader(editorOutR)
	resultCh := make(chan readResult, 4)
	go func() {
		for {
			_, body, err := reader.Read()
			resultCh <- readResult{body, err}
			if err != nil {
				return
			}
		}
	}()

	deadline := time.After(10 * time.Second)
	initialized := false
	for !initialized {
		select {
		case r := <-resultCh:
			if r.err != nil {
				t.Fatalf("editor read errored before initialize response: %v", r.err)
			}
			var env struct {
				ID     json.RawMessage `json:"id"`
				Result json.RawMessage `json:"result"`
			}
			if err := json.Unmarshal(r.body, &env); err != nil {
				continue
			}
			if !strings.Contains(string(env.Result), `"capabilities"`) {
				continue
			}
			initialized = true
		case <-deadline:
			t.Fatal("initialize response did not arrive in 10s")
		}
	}

	cancel()
	editorInW.Close()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("RunLSPServer should shut down cleanly, got %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("RunLSPServer did not return after cancel")
	}
}
