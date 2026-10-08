package main

import (
	"errors"
	"fmt"

	"golang.org/x/sys/unix"
)

// darwinReference owns a dedicated original EVFILT_PROC registration. The
// enrollment receipt acknowledges the kernel knote before the target gate is
// released. NOTE_EXIT remains a sticky result after its event is consumed.
type darwinReference struct {
	fd      int
	pid     int
	retired bool
	closed  bool
}

func acquireReference(pid int) (reference, error) {
	fd, err := unix.Kqueue()
	if err != nil {
		return nil, err
	}
	unix.CloseOnExec(fd)
	change := unix.Kevent_t{Ident: uint64(pid), Filter: unix.EVFILT_PROC, Flags: unix.EV_ADD | unix.EV_RECEIPT, Fflags: unix.NOTE_EXIT}
	receipts := make([]unix.Kevent_t, 1)
	count, err := unix.Kevent(fd, []unix.Kevent_t{change}, receipts, &unix.Timespec{})
	if err == nil && (count != 1 || receipts[0].Flags&unix.EV_ERROR == 0 || receipts[0].Data != 0) {
		err = fmt.Errorf("process registration did not acknowledge success: %v", receipts[:count])
	}
	if err != nil {
		return nil, errors.Join(err, unix.Close(fd))
	}
	return requireLive(&darwinReference{fd: fd, pid: pid})
}

func (ref *darwinReference) identity() identity {
	return identity{Platform: "darwin", Kernel: "kqueue-proc"}
}

func (ref *darwinReference) poll(milliseconds int) (bool, error) {
	if ref.closed {
		return false, errors.New("original kqueue registration is released")
	}
	if ref.retired {
		return true, nil
	}
	events := make([]unix.Kevent_t, 1)
	timeout := unix.NsecToTimespec(int64(milliseconds) * 1_000_000)
	count, err := unix.Kevent(ref.fd, nil, events, &timeout)
	if err != nil || count == 0 {
		return false, err
	}
	event := events[0]
	if event.Flags&unix.EV_ERROR != 0 || event.Ident != uint64(ref.pid) || event.Filter != unix.EVFILT_PROC || event.Fflags&unix.NOTE_EXIT == 0 {
		return false, fmt.Errorf("unexpected original process event: %v", event)
	}
	ref.retired = true
	return true, nil
}

func (ref *darwinReference) close() error {
	if ref.closed {
		return errors.New("original kqueue registration is already released")
	}
	ref.closed = true
	return unix.Close(ref.fd)
}
