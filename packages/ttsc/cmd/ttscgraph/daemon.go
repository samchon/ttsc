package main

import (
  "fmt"
  "io"
  "net"
  "os"
  "sync"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// runDaemon builds one resident MCP server for the project and serves it over a
// localhost TCP listener, so many short-lived proxy connections (one per agent
// session) share a single type-check instead of each rebuilding the Program. It
// is the build-once primitive for large repositories whose checker build is too
// slow to repeat per session. The chosen address is written to portFile (and
// announced on stdout) for a launcher to discover; the daemon serves until it is
// killed or has been idle past idle.
func runDaemon(cwd, tsconfig, portFile string, idle time.Duration) int {
  server := mcp.NewLazyServer(cwd, tsconfig, driver.LoadProgramOptions{})

  listener, err := net.Listen("tcp", "127.0.0.1:0")
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: daemon listen: %v\n", err)
    return 1
  }
  addr := listener.Addr().String()
  if portFile != "" {
    if err := os.WriteFile(portFile, []byte(addr+"\n"), 0o600); err != nil {
      fmt.Fprintf(stderr, "ttscgraph: write port file: %v\n", err)
      return 1
    }
    defer func() { _ = os.Remove(portFile) }()
  }
  fmt.Fprintf(stdout, "ttscgraph daemon listening on %s\n", addr)

  var (
    mu     sync.Mutex
    active int
    last   = time.Now()
  )
  if idle > 0 {
    go func() {
      ticker := time.NewTicker(30 * time.Second)
      defer ticker.Stop()
      for range ticker.C {
        mu.Lock()
        quiet := active == 0 && time.Since(last) > idle
        mu.Unlock()
        if quiet {
          if portFile != "" {
            _ = os.Remove(portFile)
          }
          os.Exit(0)
        }
      }
    }()
  }

  for {
    conn, err := listener.Accept()
    if err != nil {
      return 0
    }
    mu.Lock()
    active++
    mu.Unlock()
    go func() {
      defer conn.Close()
      defer func() {
        mu.Lock()
        active--
        last = time.Now()
        mu.Unlock()
      }()
      _ = server.Serve(conn, conn)
    }()
  }
}

// runConnect is the proxy: it dials a running daemon and pipes this process's
// stdin and stdout to it, so the agent's MCP client talks to the warm daemon
// transparently. It returns when stdin closes (the client disconnects).
func runConnect(addr string) int {
  conn, err := net.Dial("tcp", addr)
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: connect %s: %v\n", addr, err)
    return 1
  }
  defer conn.Close()

  // Forward requests in the background and half-close the write side on stdin
  // EOF, so the daemon sees the client disconnect. Block on the response copy:
  // it returns when the daemon has answered everything and closed the
  // connection, so the proxy does not exit (and drop responses) the moment
  // stdin is drained.
  go func() {
    _, _ = io.Copy(conn, stdin)
    if tcp, ok := conn.(*net.TCPConn); ok {
      _ = tcp.CloseWrite()
    }
  }()
  _, _ = io.Copy(stdout, conn)
  return 0
}
