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
  // mklink is a cmd.exe builtin. Feed a constant command over stdin and use
  // delayed environment expansion so Go never has to quote a command string
  // for cmd.exe. Delayed values are substituted after cmd has classified the
  // command's metacharacters, keeping every character in each path as data.
  cmd := exec.Command("cmd.exe", "/d", "/q", "/v:on")
  cmd.Stdin = strings.NewReader(
    "mklink /J \"!TTSC_WINDOWS_JUNCTION_LINK!\" \"!TTSC_WINDOWS_JUNCTION_TARGET!\"\r\nexit /b !errorlevel!\r\n",
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
