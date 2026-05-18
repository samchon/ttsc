package driver_test

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// proxyHarness wires the byte-level LSP proxy onto in-memory pipes so
// tests can drive editor traffic, simulate the upstream tsgo server's
// outgoing traffic, and observe what the proxy chose to forward versus
// rewrite. Every test owns its own harness via t.Cleanup so closes are
// deterministic even when an assertion fails mid-frame.
type proxyHarness struct {
	t      *testing.T
	proxy  *driver.Proxy
	cancel context.CancelFunc

	editorInW    *io.PipeWriter
	upstreamOutW *io.PipeWriter

	editorOutFR  *driver.FrameReader
	upstreamInFR *driver.FrameReader

	runErrMu sync.Mutex
	runErr   error
	runDone  chan struct{}
}

// newProxyHarness constructs the harness with the supplied PluginSource.
// Passing a nil source makes the proxy fall back to NullPluginSource{}.
func newProxyHarness(t *testing.T, source driver.PluginSource) *proxyHarness {
	t.Helper()
	edInR, edInW := io.Pipe()
	edOutR, edOutW := io.Pipe()
	upInR, upInW := io.Pipe()
	upOutR, upOutW := io.Pipe()

	ctx, cancel := context.WithCancel(context.Background())
	proxy := driver.NewProxy(driver.ProxyOptions{
		EditorIn:    edInR,
		EditorOut:   edOutW,
		UpstreamIn:  upInW,
		UpstreamOut: upOutR,
		Source:      source,
	})

	h := &proxyHarness{
		t:            t,
		proxy:        proxy,
		cancel:       cancel,
		editorInW:    edInW,
		upstreamOutW: upOutW,
		editorOutFR:  driver.NewFrameReader(edOutR),
		upstreamInFR: driver.NewFrameReader(upInR),
		runDone:      make(chan struct{}),
	}
	go func() {
		err := proxy.Run(ctx)
		h.runErrMu.Lock()
		h.runErr = err
		h.runErrMu.Unlock()
		close(h.runDone)
		edInR.Close()
		edOutW.Close()
		upInW.Close()
		upOutR.Close()
	}()
	t.Cleanup(func() {
		h.shutdown()
	})
	return h
}

// shutdown closes the proxy by draining both inbound streams. Tests
// should call this directly only when they need to assert on the
// returned error; otherwise t.Cleanup runs it.
func (h *proxyHarness) shutdown() error {
	_ = h.editorInW.Close()
	_ = h.upstreamOutW.Close()
	select {
	case <-h.runDone:
	case <-time.After(3 * time.Second):
		h.cancel()
		select {
		case <-h.runDone:
		case <-time.After(time.Second):
			h.t.Fatal("proxy.Run did not return after cancel")
		}
	}
	h.runErrMu.Lock()
	defer h.runErrMu.Unlock()
	return h.runErr
}

// sendEditor writes a frame to the editor->proxy stream.
func (h *proxyHarness) sendEditor(body []byte) {
	h.t.Helper()
	if err := driver.WriteFrame(h.editorInW, body); err != nil {
		h.t.Fatalf("sendEditor write: %v", err)
	}
}

// sendUpstream writes a frame as if it came from the upstream tsgo
// server toward the editor.
func (h *proxyHarness) sendUpstream(body []byte) {
	h.t.Helper()
	if err := driver.WriteFrame(h.upstreamOutW, body); err != nil {
		h.t.Fatalf("sendUpstream write: %v", err)
	}
}

// recvUpstream returns the next frame the proxy forwarded to the
// upstream tsgo server (i.e. an editor->server message after the proxy's
// intercepts). Times out after two seconds to keep failing tests fast.
func (h *proxyHarness) recvUpstream() []byte {
	h.t.Helper()
	return h.readWithTimeout(h.upstreamInFR, "upstream")
}

// recvEditor returns the next frame the proxy sent back to the editor.
func (h *proxyHarness) recvEditor() []byte {
	h.t.Helper()
	return h.readWithTimeout(h.editorOutFR, "editor")
}

func (h *proxyHarness) readWithTimeout(fr *driver.FrameReader, label string) []byte {
	h.t.Helper()
	type readResult struct {
		body []byte
		err  error
	}
	result := make(chan readResult, 1)
	go func() {
		_, body, err := fr.Read()
		result <- readResult{body, err}
	}()
	select {
	case r := <-result:
		if r.err != nil && !errors.Is(r.err, driver.ErrFrameClosed) {
			h.t.Fatalf("%s frame read: %v", label, r.err)
		}
		return r.body
	case <-time.After(2 * time.Second):
		h.t.Fatalf("%s frame did not arrive in 2s", label)
		return nil
	}
}

// expectNoUpstreamFrame asserts that no frame is sitting in the upstream
// buffer within a short window. Used by intercept tests to confirm
// locally-handled requests do not leak through to the upstream tsgo
// server. The window is generous enough to absorb goroutine scheduling
// jitter while keeping failures fast.
func (h *proxyHarness) expectNoUpstreamFrame(window time.Duration) {
	h.t.Helper()
	type readResult struct {
		body []byte
		err  error
	}
	done := make(chan readResult, 1)
	go func() {
		_, body, err := h.upstreamInFR.Read()
		done <- readResult{body, err}
	}()
	select {
	case r := <-done:
		if r.err != nil {
			return
		}
		h.t.Fatalf("upstream received a frame it should not have:\n%s", r.body)
	case <-time.After(window):
	}
}
