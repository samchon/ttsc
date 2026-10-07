//go:build linux

package sourceprocess

import (
	"errors"
	"golang.org/x/sys/unix"
)

func prepareReaper() error { return unix.Prctl(unix.PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) }

func orphanReaping() string { return "owned" }

func reapGroup(group int) error {
	for {
		var status unix.WaitStatus
		pid, err := unix.Wait4(-group, &status, unix.WNOHANG, nil)
		if errors.Is(err, unix.ECHILD) { return nil }
		if errors.Is(err, unix.EINTR) { continue }
		if err != nil { return err }
		if pid == 0 { return nil }
	}
}
