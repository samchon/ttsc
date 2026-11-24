package utility

import (
  "errors"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// The linked-plugin registry is process-wide and a manifest entry selects the
// registration at its own position, so the check-serve tests register their
// probes once, in a fixed order: index 0 answers CheckProgram, index 1 is a
// ProgramPlugin without it. A one-entry manifest selects only the checking
// probe; a two-entry manifest adds the mutating one.
func init() {
  driver.RegisterPlugin(checkServeCheckingProbe{})
  driver.RegisterPlugin(checkServeProgramPluginProbe{})
}

// checkServeCheckingFailure makes the checking probe fail its next answers.
var checkServeCheckingFailure bool

// checkServeCheckingProbe would panic if mutated through ApplyProgram, and
// answers CheckProgram with the configured outcome.
type checkServeCheckingProbe struct{}

func (checkServeCheckingProbe) ApplyProgram(*driver.Program, driver.PluginContext) error {
  panic("check-serve must answer through CheckProgram")
}

func (checkServeCheckingProbe) CheckProgram(*driver.Program, driver.PluginContext) error {
  if checkServeCheckingFailure {
    return errors.New("probe: configured failure")
  }
  return nil
}

// checkServeProgramPluginProbe is a no-op ProgramPlugin without CheckProgram.
type checkServeProgramPluginProbe struct{}

func (checkServeProgramPluginProbe) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return nil
}
