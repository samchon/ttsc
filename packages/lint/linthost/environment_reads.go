package linthost

import (
  "os"
  "sort"
  "sync"
)

// lintEnvironment records every environment variable a lint rule read, with
// the value the read returned, as an input of the check results this process
// publishes (samchon/ttsc#1855).
//
// The browserslist port picks a rule's target browsers from BROWSERSLIST,
// BROWSERSLIST_ENV, NODE_ENV and their kin, so those variables decide
// diagnostics. A check observation lists them, and a consumer that reuses a
// stored check result (`ttsx`, `@ttsc/unplugin`, `@ttsc/metro`) refuses it once
// a listed value differs, exactly as it does for a linked plugin's
// PluginContext.Env reads. The standalone lint module cannot import ttsc's
// driver, so it keeps its own ledger in the same wire shape.
//
// The ledger is process-wide and only grows. A process's environment does not
// change, and a rule result cached in the process (the polyfill target sets)
// depends on reads an earlier check made, so every check this process
// publishes names every read so far. A read another project made can only cost
// reuse, never admit a changed input.
var lintEnvironment = struct {
  sync.Mutex
  reads map[string]*string
}{reads: map[string]*string{}}

// lintGetenv returns the value of the environment variable name, like
// os.Getenv, and records the read. An unset variable is recorded as absent.
func lintGetenv(name string) string {
  value, ok := os.LookupEnv(name)
  lintEnvironment.Lock()
  if _, seen := lintEnvironment.reads[name]; !seen {
    if ok {
      recorded := value
      lintEnvironment.reads[name] = &recorded
    } else {
      lintEnvironment.reads[name] = nil
    }
  }
  lintEnvironment.Unlock()
  return value
}

// lintEnvironmentInputs returns a copy of every recorded read, keyed by name,
// or nil when no rule read a variable, so an observation that read none keeps
// its previous shape.
func lintEnvironmentInputs() map[string]*string {
  lintEnvironment.Lock()
  defer lintEnvironment.Unlock()
  if len(lintEnvironment.reads) == 0 {
    return nil
  }
  names := make([]string, 0, len(lintEnvironment.reads))
  for name := range lintEnvironment.reads {
    names = append(names, name)
  }
  sort.Strings(names)
  inputs := make(map[string]*string, len(names))
  for _, name := range names {
    if value := lintEnvironment.reads[name]; value != nil {
      copied := *value
      inputs[name] = &copied
    } else {
      inputs[name] = nil
    }
  }
  return inputs
}
