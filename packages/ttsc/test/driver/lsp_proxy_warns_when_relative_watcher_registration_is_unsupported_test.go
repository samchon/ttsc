package driver_test

import (
  "bytes"
  "path/filepath"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyWarnsWhenRelativeWatcherRegistrationIsUnsupported verifies the
// proxy does not pretend a partial in-project watcher covers external inputs.
//
// A client without relative file-pattern support can still be registered for
// workspace-relative globs, which would silently drop every declared input
// living outside the workspace. Telling the user is the only honest outcome,
// so the proxy must log instead of registering a watcher it knows is partial.
//
//  1. Initialize a client advertising dynamic registration without relative
//     pattern support, while a declared input sits outside the project.
//  2. Complete the initialize handshake.
//  3. Assert the proxy logs the unsupported-capability notice.
//  4. Assert no registration request follows it.
func TestLSPProxyWarnsWhenRelativeWatcherRegistrationIsUnsupported(t *testing.T) {
  root := t.TempDir()
  external := t.TempDir()
  source := &projectInputRegistrationSource{
    snapshot: driver.LSPProjectInputSnapshot{
      Root:  filepath.ToSlash(root),
      Files: []string{filepath.ToSlash(filepath.Join(external, "docs", "spec.md"))},
    },
  }
  h := newProxyHarness(t, source)

  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{"workspace":{"didChangeWatchedFiles":{"dynamicRegistration":true,"relativePatternSupport":false}}}}}`)
  h.sendEditor(initialize)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}`))
  _ = h.recvEditor()
  initialized := []byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`)
  h.sendEditor(initialized)
  _ = h.recvUpstream()
  notice := h.recvEditor()
  if !bytes.Contains(notice, []byte(`"window/logMessage"`)) ||
    !bytes.Contains(notice, []byte(`dynamic relative file-pattern`)) {
    t.Fatalf("unsupported client notice = %s", notice)
  }
  h.expectNoEditorFrame(100 * time.Millisecond)
}
