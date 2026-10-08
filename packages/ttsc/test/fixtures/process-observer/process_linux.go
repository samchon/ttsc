package main

import (
	"errors"
	"fmt"

	"golang.org/x/sys/unix"
)

// linuxReference pins the original process through a pidfd (Linux 5.3+).
// POLLIN means the entire thread group exited; POLLHUP also covers reaping.
// No /proc directory descriptor or repeated numeric lookup substitutes for it.
type linuxReference struct {
	fd     int
	closed bool
}

func acquireReference(pid int) (reference, error) {
	fd, err := unix.PidfdOpen(pid, 0)
	if err != nil {
		return nil, err
	}
	unix.CloseOnExec(fd)
	return requireLive(&linuxReference{fd: fd})
}

func (ref *linuxReference) identity() identity {
	return identity{Platform: "linux", Kernel: "pidfd"}
}

func (ref *linuxReference) poll(milliseconds int) (bool, error) {
	if ref.closed {
		return false, errors.New("original pidfd is released")
	}
	rows := []unix.PollFd{{Fd: int32(ref.fd), Events: unix.POLLIN}}
	_, err := unix.Poll(rows, milliseconds)
	if err != nil {
		return false, err
	}
	flags := rows[0].Revents
	if flags&(unix.POLLERR|unix.POLLNVAL) != 0 {
		return false, fmt.Errorf("pidfd poll failed with flags %d", flags)
	}
	return flags&(unix.POLLIN|unix.POLLHUP) != 0, nil
}

func (ref *linuxReference) close() error {
	if ref.closed {
		return errors.New("original pidfd is already released")
	}
	ref.closed = true
	return unix.Close(ref.fd)
}
