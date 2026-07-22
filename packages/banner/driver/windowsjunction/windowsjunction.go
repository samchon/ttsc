// Package windowsjunction creates a Windows directory junction without
// interpolating filesystem paths into cmd.exe syntax.
package windowsjunction

import (
  "fmt"
  "os"
  "os/exec"
  "strings"
)

const (
  linkEnvironment   = "TTSC_WINDOWS_JUNCTION_LINK"
  targetEnvironment = "TTSC_WINDOWS_JUNCTION_TARGET"
)

// Create makes link a directory junction that points to target.
func Create(link, target string) error {
  // mklink is a cmd.exe builtin. Keep paths out of the command text so legal
  // filename characters such as &, ^, %, and parentheses are data rather than
  // shell syntax. Percent expansion substitutes each variable once; percent
  // sequences inside its value are not recursively expanded.
  cmd := exec.Command(
    "cmd.exe",
    "/d",
    "/v:off",
    "/s",
    "/c",
    `mklink /J "%TTSC_WINDOWS_JUNCTION_LINK%" "%TTSC_WINDOWS_JUNCTION_TARGET%"`,
  )
  cmd.Env = append(
    os.Environ(),
    linkEnvironment+"="+link,
    targetEnvironment+"="+target,
  )
  if out, err := cmd.CombinedOutput(); err != nil {
    return fmt.Errorf(
      "mklink /J failed: %v: %s",
      err,
      strings.TrimSpace(string(out)),
    )
  }
  return nil
}
