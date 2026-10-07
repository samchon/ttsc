package main

import (
	"errors"
	"fmt"
	"strconv"

	"golang.org/x/sys/windows"
)

// windowsReference retains the original kernel process object. Numeric PID
// reuse cannot redirect WaitForSingleObject or the creation FILETIME identity.
type windowsReference struct {
	handle  windows.Handle
	created string
	closed  bool
}

func acquireReference(pid int) (reference, error) {
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return nil, err
	}
	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(handle, &creation, &exit, &kernel, &user); err != nil {
		return nil, errors.Join(err, windows.CloseHandle(handle))
	}
	stamp := uint64(creation.HighDateTime)<<32 | uint64(creation.LowDateTime)
	return requireLive(&windowsReference{handle: handle, created: strconv.FormatUint(stamp, 10)})
}

func (ref *windowsReference) identity() identity {
	return identity{Platform: "win32", Kernel: "windows-handle", Creation: ref.created}
}

func (ref *windowsReference) poll(milliseconds int) (bool, error) {
	if ref.closed {
		return false, errors.New("original process handle is released")
	}
	state, err := windows.WaitForSingleObject(ref.handle, uint32(milliseconds))
	if err != nil {
		return false, err
	}
	switch state {
	case windows.WAIT_OBJECT_0:
		return true, nil
	case uint32(windows.WAIT_TIMEOUT):
		return false, nil
	default:
		return false, fmt.Errorf("unexpected process wait status %d", state)
	}
}

func (ref *windowsReference) close() error {
	if ref.closed {
		return errors.New("original process handle is already released")
	}
	ref.closed = true
	return windows.CloseHandle(ref.handle)
}
