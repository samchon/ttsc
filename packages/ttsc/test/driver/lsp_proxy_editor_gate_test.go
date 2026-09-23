package driver_test

import (
  "io"
  "sync"
)

// editorGate stands between the proxy and the editor side of the harness
// pipe. It passes every write through, except that once armed it holds the
// next write until released, so a test knows the proxy is inside that write
// and can assert what the proxy does meanwhile.
type editorGate struct {
  w        io.Writer
  mu       sync.Mutex
  armed    bool
  entered  chan struct{}
  release  chan struct{}
  released sync.Once
}

func newEditorGate(w io.Writer) *editorGate {
  return &editorGate{
    w:       w,
    entered: make(chan struct{}),
    release: make(chan struct{}),
  }
}

// arm makes the next write hold until open is called.
func (g *editorGate) arm() {
  g.mu.Lock()
  g.armed = true
  g.mu.Unlock()
}

// open lets a held write through, and every write after it. It is safe to call
// more than once, so a test can also call it from cleanup, where a failed
// assertion would otherwise leave the proxy's writer held past shutdown.
func (g *editorGate) open() {
  g.released.Do(func() { close(g.release) })
}

func (g *editorGate) Write(p []byte) (int, error) {
  g.mu.Lock()
  hold := g.armed
  g.armed = false
  g.mu.Unlock()
  if hold {
    close(g.entered)
    <-g.release
  }
  return g.w.Write(p)
}
