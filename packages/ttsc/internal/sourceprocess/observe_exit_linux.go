//go:build linux

package sourceprocess

import (
	"errors"

	"golang.org/x/sys/unix"
)

// observeExit observes child termination without consuming its wait status.
// WNOWAIT keeps the PID allocated until the owner has signalled its group.
func observeExit(pid int) <-chan error {
	finished := make(chan error, 1)
	go func() {
		var info unix.Siginfo
		for {
			err := unix.Waitid(unix.P_PID, pid, &info, unix.WEXITED|unix.WNOWAIT, nil)
			if errors.Is(err, unix.EINTR) { continue }
			finished <- err
			return
		}
	}()
	return finished
}
