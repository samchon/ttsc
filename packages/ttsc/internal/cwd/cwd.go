package cwd

import "fmt"

// Resolve returns an explicit working directory override or asks the host OS
// for the current process directory.
func Resolve(override string, getwd func() (string, error)) (string, error) {
  if override != "" {
    return override, nil
  }
  wd, err := getwd()
  if err != nil {
    return "", fmt.Errorf("could not get working directory: %w", err)
  }
  return wd, nil
}
