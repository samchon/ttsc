package main

import (
  "bufio"
  "encoding/json"
  "net"
  "os"
  "path/filepath"
  "strings"
  "testing"
  "time"
)

// TestRunDaemonServesOverLoopback verifies runDaemon builds the resident server
// once and answers MCP over its loopback TCP listener, the build-once primitive
// the proxy mode connects to. It pins the accept-and-serve loop: a real client
// dials the announced address, drives the JSON-RPC initialize handshake, and
// gets back the ttsc-graph server identity from the warm Program.
//
// The idle watchdog is intentionally disabled (idle=0) and not asserted: it
// fires on a 30s ticker and exits the process, so it is not unit-testable here.
// The daemon goroutine is left running at test end; the test binary exiting
// reclaims it, and no idle-exit / port-file-removal behavior is checked.
//
//  1. Write a minimal valid project and start runDaemon in a goroutine.
//  2. Poll the port file for the 127.0.0.1:<port> line, then dial it.
//  3. Send one initialize request and assert result.serverInfo.name.
func TestRunDaemonServesOverLoopback(t *testing.T) {
  root := t.TempDir()
  writeDaemonFixture(t, root)
  portFile := filepath.Join(root, "port")

  go runDaemon(root, "tsconfig.json", portFile, 0)

  addr := pollPortFile(t, portFile, 30*time.Second)
  conn, err := net.Dial("tcp", addr)
  if err != nil {
    t.Fatalf("dial daemon at %s: %v", addr, err)
  }
  defer conn.Close()

  if _, err := conn.Write([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}` + "\n")); err != nil {
    t.Fatalf("write initialize: %v", err)
  }

  // The server flushes one newline-delimited response per request.
  line, err := bufio.NewReader(conn).ReadBytes('\n')
  if err != nil {
    t.Fatalf("read response: %v", err)
  }

  var envelope struct {
    Result struct {
      ServerInfo struct {
        Name string `json:"name"`
      } `json:"serverInfo"`
    } `json:"result"`
  }
  if err := json.Unmarshal(line, &envelope); err != nil {
    t.Fatalf("unmarshal response %q: %v", line, err)
  }
  if envelope.Result.ServerInfo.Name != "ttsc-graph" {
    t.Fatalf("serverInfo.name = %q, want ttsc-graph (response: %s)", envelope.Result.ServerInfo.Name, line)
  }
}

// pollPortFile waits up to timeout for portFile to hold a 127.0.0.1:<port>
// address line, returning the trimmed address.
func pollPortFile(t *testing.T, portFile string, timeout time.Duration) string {
  t.Helper()
  deadline := time.Now().Add(timeout)
  for time.Now().Before(deadline) {
    data, err := os.ReadFile(portFile)
    if err == nil {
      addr := strings.TrimSpace(string(data))
      if strings.HasPrefix(addr, "127.0.0.1:") {
        return addr
      }
    }
    time.Sleep(20 * time.Millisecond)
  }
  t.Fatalf("port file %s never received a 127.0.0.1:<port> address", portFile)
  return ""
}

// writeDaemonFixture writes a minimal valid project (one src file + tsconfig)
// for the daemon to build.
func writeDaemonFixture(t *testing.T, root string) {
  t.Helper()
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
}
