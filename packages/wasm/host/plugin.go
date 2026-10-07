package host

import (
  "bytes"
  "io"
  "sync"
)

// Plugin is the in-process equivalent of ttsc's native CLI sidecar.
//
// The browser cannot spawn plugin binaries, so a consumer wasm links their Go
// adapters and registers them with Config. Every run receives invocation-owned
// streams; a plugin must write only to those streams, never os.Stdout or
// os.Stderr.
//
// @evidence contracts/common.md#principled-implementation A small Go interface supplies named command dispatch through invocation-owned streams.
// @evidence contracts/common.md#clear-and-simple-design Name identifies registration and Run owns command execution; invocation context and streams are supplied through one request rather than host-owned plugin-specific APIs.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported plugin boundary avoids mutating process-global stdout/stderr to capture a call.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain browser linkage and stream ownership under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Plugin is an interface that acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms Plugin is an interface that chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Plugin is an interface that coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Plugin declares command dispatch for in-process adapters and carries no native path, process or platform decision.
type Plugin interface {
  // Name is the npm-style plugin id passed to api.plugin.
  //
  // @evidence contracts/common.md#principled-implementation Explicit registration identity decouples dispatch from the concrete plugin type.
  // @evidence contracts/common.md#clear-and-simple-design One name query supplies the registry key without exposing command state or concrete plugin implementation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation declares its id rather than being recognized by a consumer-specific type check.
  // @evidence contracts/common.md#meaningful-documentation The Go member comment names the API consumer under the documentation skill's context rule.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Plugin.Name is an abstract method; the invocation and the concrete plugin own its resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Plugin.Name is an abstract method; the concrete plugin chooses its algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Plugin.Name is an abstract method; the concrete plugin owns any reuse of its work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Plugin.Name is an interface method with no native path, process or platform decision.
  Name() string

  // Run dispatches one subcommand and returns the native CLI exit code.
  //
  // @evidence contracts/common.md#principled-implementation A request object supplies context, arguments and owned writers through one Go extension boundary.
  // @evidence contracts/common.md#clear-and-simple-design One invocation groups command inputs and owned effects; command-specific parsing stays with the implementation rather than the generic host.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Commands run through the registered implementation rather than changing a foreign global launcher.
  // @evidence contracts/common.md#meaningful-documentation The member comment states dispatch and exit-code roles under the documentation skill's clarity rule.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Plugin.Run is an abstract method; the invocation and the concrete plugin own its resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Plugin.Run is an abstract method; the concrete plugin chooses its algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Plugin.Run is an abstract method; the concrete plugin owns any reuse of its work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Plugin.Run is an interface method with no native path, process or platform decision.
  Run(invocation *PluginInvocation) int
}

// Config carries the optional registrations the host applies before binding
// globalThis[name]. Pass Config{} for a vanilla ttsc + tsgo wasm.
//
// @evidence contracts/common.md#principled-implementation An explicit slice of the small Plugin interface keeps linkage and registration with the consumer host.
// @evidence contracts/common.md#clear-and-simple-design One registration list is sufficient for the host factory; command options and mutable invocation state remain owned by the selected plugin call.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host receives linked registrations rather than guessing installed packages from hardcoded ids.
// @evidence contracts/common.md#meaningful-documentation The native comment explains empty configuration and registration timing under the documentation skill's context rule.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Config is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms Config is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Config is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Config is a data type and performs no native filesystem, path or process operation.
type Config struct {
  // Plugins are registered once; empty names and nil entries are skipped.
  Plugins []Plugin
}

// invocationBuffer serializes writers owned by one invocation. Closing it
// prevents an unregistered or late goroutine from modifying a completed result.
type invocationBuffer struct {
  mu     sync.Mutex
  data   bytes.Buffer
  closed bool
}

func (buffer *invocationBuffer) Write(data []byte) (int, error) {
  buffer.mu.Lock()
  defer buffer.mu.Unlock()
  if buffer.closed {
    return 0, io.ErrClosedPipe
  }
  return buffer.data.Write(data)
}

func (buffer *invocationBuffer) String() string {
  buffer.mu.Lock()
  defer buffer.mu.Unlock()
  return buffer.data.String()
}

func (buffer *invocationBuffer) close() {
  buffer.mu.Lock()
  buffer.closed = true
  buffer.mu.Unlock()
}
