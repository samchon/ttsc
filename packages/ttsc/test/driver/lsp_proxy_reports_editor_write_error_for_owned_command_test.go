package driver_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyReportsEditorWriteErrorForOwnedCommand verifies locally-handled
// executeCommand responses surface editor write failures.
//
// The proxy writes ttsc-owned command responses directly to the editor instead
// of forwarding them upstream. If that write fails because the editor side is
// already closed, the proxy must return the IO error instead of swallowing it
// and waiting for more input.
//
// 1. Create a proxy with a source that handles `ttsc.noop` locally.
// 2. Close the editor output reader before sending the command request.
// 3. Close upstream output so the sibling pump can drain.
// 4. Assert Proxy.Run returns a closed-pipe write error.
func TestLSPProxyReportsEditorWriteErrorForOwnedCommand(t *testing.T) {
	editorInR, editorInW := io.Pipe()
	editorOutR, editorOutW := io.Pipe()
	upstreamInR, upstreamInW := io.Pipe()
	upstreamOutR, upstreamOutW := io.Pipe()
	defer editorInR.Close()
	defer editorInW.Close()
	defer editorOutW.Close()
	defer upstreamInR.Close()
	defer upstreamInW.Close()
	defer upstreamOutR.Close()
	defer upstreamOutW.Close()

	source := &stubSource{
		commands: []string{"ttsc.noop"},
		execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
			return nil, nil
		},
	}
	proxy := driver.NewProxy(driver.ProxyOptions{
		EditorIn:    editorInR,
		EditorOut:   editorOutW,
		UpstreamIn:  upstreamInW,
		UpstreamOut: upstreamOutR,
		Source:      source,
	})

	done := make(chan error, 1)
	go func() {
		done <- proxy.Run(context.Background())
	}()

	if err := editorOutR.Close(); err != nil {
		t.Fatalf("close editor output reader: %v", err)
	}
	request := []byte(`{"jsonrpc":"2.0","id":1,"method":"workspace/executeCommand","params":{"command":"ttsc.noop"}}`)
	if err := driver.WriteFrame(editorInW, request); err != nil {
		t.Fatalf("send command request: %v", err)
	}
	if err := upstreamOutW.Close(); err != nil {
		t.Fatalf("close upstream output: %v", err)
	}

	select {
	case err := <-done:
		if err == nil || !errors.Is(err, io.ErrClosedPipe) {
			t.Fatalf("expected closed-pipe write error, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("proxy.Run did not return after editor write failure")
	}
}
