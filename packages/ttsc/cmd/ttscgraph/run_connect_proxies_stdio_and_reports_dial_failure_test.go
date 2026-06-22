package main

import (
  "bytes"
  "net"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestRunConnectProxiesStdioAndReportsDialFailure verifies the proxy mode on
// both of its paths: it pipes the process's stdio to a live daemon and returns
// the daemon's reply, and it reports a dial failure with exit 1 when no daemon
// is listening.
//
// The proxy half-closes its write side on stdin EOF so the daemon sees the
// client disconnect, then blocks on copying the response back; runConnect only
// returns once the server has answered and closed the connection. The success
// path pins that handshake-then-drain ordering against a real loopback server;
// the failure path pins the dial-error branch.
//
//  1. Stand up a loopback mcp.Server, point stdin at one initialize request and
//     stdout at a buffer, and call runConnect against it.
//  2. Assert the buffer carries the ttsc-graph initialize response and exit 0.
//  3. Call runConnect against an unused port and assert exit 1 with a "connect"
//     diagnostic on stderr.
func TestRunConnectProxiesStdioAndReportsDialFailure(t *testing.T) {
  oldStdin, oldStdout, oldStderr := stdin, stdout, stderr
  defer func() { stdin, stdout, stderr = oldStdin, oldStdout, oldStderr }()

  // (a) Proxy stdio to a live server and read back its initialize response.
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), `export const value: number = 1;
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatalf("load program: %v", err)
  }
  defer func() { _ = prog.Close() }()

  ln, err := net.Listen("tcp", "127.0.0.1:0")
  if err != nil {
    t.Fatalf("listen: %v", err)
  }
  defer ln.Close()
  go func() {
    conn, acceptErr := ln.Accept()
    if acceptErr != nil {
      return
    }
    defer conn.Close()
    server := mcp.NewServer(prog)
    // Serve returns when the proxy half-closes its write side (stdin EOF).
    _ = server.Serve(conn, conn)
  }()

  var proxyOut bytes.Buffer
  stdin = strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}` + "\n")
  stdout = &proxyOut
  if code := runConnect(ln.Addr().String()); code != 0 {
    t.Fatalf("runConnect to live daemon exit = %d, want 0", code)
  }
  if got := proxyOut.String(); !strings.Contains(got, "serverInfo") || !strings.Contains(got, "ttsc-graph") {
    t.Fatalf("proxy did not relay the initialize response:\n%s", got)
  }

  // (b) Dialing an unused port fails: exit 1 with a "connect" diagnostic.
  var dialErr bytes.Buffer
  stdin = strings.NewReader("")
  stdout = &bytes.Buffer{}
  stderr = &dialErr
  if code := runConnect("127.0.0.1:1"); code != 1 {
    t.Fatalf("runConnect to unused port exit = %d, want 1", code)
  }
  if !strings.Contains(dialErr.String(), "connect") {
    t.Fatalf("dial failure did not report a connect error:\n%s", dialErr.String())
  }
}

// writeGraphFile writes content to path, creating parent directories. Shared by
// the command tests in this package.
func writeGraphFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}
