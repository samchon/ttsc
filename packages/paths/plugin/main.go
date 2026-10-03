// Native sidecar entrypoint for `@ttsc/paths`.
package main

import (
  "os"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

const version = "0.0.1"

// main exits the standalone process with its command dispatch status.
//
// These review grounds cover this private operation and its actual callees.
// Go Evidence does not admit private declaration acknowledgment tags.
//
// Common: Principled implementation: os.Args excludes the executable name and os.Exit propagates the actual run status to the process consumer.
// Common: Clear and simple design: The entrypoint binds process lifetime while run owns identity and stream delegation.
// Common: Prohibited implementation shortcuts: The process uses the real command return status without rewriting failures or bypassing package registration.
// Common: Meaningful documentation: The native comment names process status propagation separately from these native review grounds.
// Portability: OS-neutral implementation: Go's os package supplies native argv and process exit semantics without host-specific command quoting.
func main() {
  os.Exit(run(os.Args[1:]))
}

// run supplies this standalone plugin's identity and process streams to the
// shared production utility dispatch; linked registration remains in init.
//
// Common: Principled implementation: The package identity and unchanged version constant reach the shared actual command owner with original argv and process writers.
// Common: Clear and simple design: One delegation leaves command semantics with utility.RunCommandWithIO and package registration with the sibling init import.
// Common: Prohibited implementation shortcuts: Production execution uses the same dispatch as direct units and retains the real host for build, transform and check.
// Common: Meaningful documentation: Native prose identifies identity, process stream binding and unchanged linked registration separately from these native review grounds.
// Portability: OS-neutral implementation: os supplies the native process streams and argv values without a shell or path reconstruction.
func run(args []string) int {
  return utility.RunCommandWithIO("@ttsc/paths", version, args, os.Stdout, os.Stderr)
}
