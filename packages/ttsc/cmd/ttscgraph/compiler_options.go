package main

import (
  "flag"
  "os"
  "strconv"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// graphCompilerOptions preserves inherited compiler arguments unless the graph
// invocation explicitly assigns mapper permission. That assignment follows the
// inherited tokens so upstream parsing owns precedence; the argument cwd stays
// paired with response files and relative compiler options on every reload.
func graphCompilerOptions(flags *flag.FlagSet, permission bool) (driver.LoadProgramOptions, error) {
  specified := false
  flags.Visit(func(option *flag.Flag) {
    if option.Name == "runExternalCode" {
      specified = true
    }
  })
  if !specified {
    return driver.LoadProgramOptions{}, nil
  }
  args, err := driver.TsgoArgsFromEnv()
  if err != nil {
    return driver.LoadProgramOptions{}, err
  }
  return driver.LoadProgramOptions{
    TsgoArgs:    append(args, "--runExternalCode", strconv.FormatBool(permission)),
    TsgoArgsCwd: os.Getenv(driver.TsgoArgsCwdEnv),
  }, nil
}
