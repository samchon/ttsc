package driver_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsUnownedCommand verifies that the proxy does not
// intercept commands the plugin source does not claim. tsgo's own
// workspace commands (refactors, code-action commands) must continue to
// reach the upstream server unmodified.
//
// 1. Configure a source that owns one command id but not another.
// 2. Send a request for the unowned command.
// 3. Assert the request reaches upstream verbatim.
func TestLSPProxyForwardsUnownedCommand(t *testing.T) {
	source := &stubSource{
		commands: []string{"ttsc.lint.fix"},
		execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
			t.Fatal("execute should not be called for unowned command")
			return nil, nil
		},
	}
	h := newProxyHarness(t, source)

	request := []byte(`{"jsonrpc":"2.0","id":1,"method":"workspace/executeCommand","params":{"command":"tsgo.refactor.extract"}}`)
	h.sendEditor(request)
	if got := h.recvUpstream(); !bytes.Equal(got, request) {
		t.Fatalf("upstream mismatch:\n%s", got)
	}
}
