//go:build windows

package sourceprocess

import (
  "encoding/json"
  "errors"
  "os"

  "golang.org/x/sys/windows"
)

// readWindowsStarted acquires the helper's suspended-target publication. An
// absent file or an actual Windows sharing violation means acquisition is
// pending, not that the helper failed or that any target was enrolled. Windows
// can briefly refuse reads while the complete file is atomically published.
// The command owner continues observing helper exit, cancellation and deadline.
//
// WARNING (#1718): keep pending file acquisition separate from process identity
// validation. Malformed JSON and other I/O failures refuse immediately; even
// readable bytes grant no RUN permission. retainWindowsTarget must still obtain
// the original process by PID, creation identity and owned Job membership.
// Never classify its native errors as a pending publication, fabricate a joined
// target from an empty Job, or replace identity proof with a retry grace period.
//
// Each attempt reads and decodes the current complete bytes with no historical
// positive cache. Work and temporary memory scale with receipt bytes, and the
// native file handle closes within os.ReadFile. Only the owning command loop
// retries; final retirement still reports unknown if original authority could
// not be acquired. The Windows build constraint owns the native error code.
func readWindowsStarted(file string) (windowsStarted, bool, error) {
  data, err := os.ReadFile(file)
  if err != nil {
    return windowsStarted{}, os.IsNotExist(err) || errors.Is(err, windows.ERROR_SHARING_VIOLATION), err
  }
  var started windowsStarted
  if err := json.Unmarshal(data, &started); err != nil {
    return windowsStarted{}, false, err
  }
  return started, false, nil
}
