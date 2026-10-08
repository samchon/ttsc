//go:build darwin

package sourceprocess

import (
	"errors"

	"golang.org/x/sys/unix"
)

// observeExit uses NOTE_EXIT without reaping the direct child. ESRCH at
// registration means this unreaped child already exited; the parent's retained
// wait status still prevents PID reuse until exec.Cmd.Wait consumes it.
func observeExit(pid int) <-chan error {
	finished := make(chan error, 1)
	queue, err := unix.Kqueue()
	if err != nil { finished <- err; return finished }
	var event unix.Kevent_t
	unix.SetKevent(&event, pid, unix.EVFILT_PROC, unix.EV_ADD|unix.EV_ENABLE|unix.EV_ONESHOT)
	event.Fflags = unix.NOTE_EXIT
	_, err = unix.Kevent(queue, []unix.Kevent_t{event}, nil, nil)
	if err != nil {
		_ = unix.Close(queue)
		if errors.Is(err, unix.ESRCH) { err = nil }
		finished <- err
		return finished
	}
	go func() {
		defer unix.Close(queue)
		var events [1]unix.Kevent_t
		for {
			count, err := unix.Kevent(queue, nil, events[:], nil)
			if errors.Is(err, unix.EINTR) { continue }
			if err != nil { finished <- err; return }
			if count == 0 { continue }
			if events[0].Flags&unix.EV_ERROR != 0 {
				finished <- unix.Errno(events[0].Data)
				return
			}
			finished <- nil
			return
		}
	}()
	return finished
}
