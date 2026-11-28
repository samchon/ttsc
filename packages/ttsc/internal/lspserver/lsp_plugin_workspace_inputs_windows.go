package lspserver

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

func initialWorkspaceFileIdentity(pluginWorkspaceFile) os.FileInfo { return nil }

// Windows file times are 100 ns ticks from January 1601.
func workspaceWindowsTime(value int64) string {
	time := syscall.Filetime{LowDateTime: uint32(value), HighDateTime: uint32(uint64(value) >> 32)}
	return fmt.Sprint(time.Nanoseconds())
}

// Read the same Windows volume, file identity and change times that Node
// obtains through libuv, opening the reparse point itself for link metadata.
func (input pluginWorkspaceFile) current() bool {
	location := filepath.Clean(input.location)
	if !strings.HasPrefix(location, `\\?\`) {
		if tail, ok := strings.CutPrefix(location, `\\`); ok {
			location = `\\?\UNC\` + tail
		} else {
			location = `\\?\` + location
		}
	}
	name, err := windows.UTF16PtrFromString(location)
	if err != nil {
		return false
	}
	flags := uint32(windows.FILE_FLAG_BACKUP_SEMANTICS)
	if input.Kind == "link" {
		flags |= windows.FILE_FLAG_OPEN_REPARSE_POINT
	}
	handle, err := windows.CreateFile(name, windows.FILE_READ_ATTRIBUTES,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil, windows.OPEN_EXISTING, flags, 0)
	if err != nil {
		return input.Mode == nil
	}
	defer windows.CloseHandle(handle)
	var info windows.ByHandleFileInformation
	if windows.GetFileInformationByHandle(handle, &info) != nil {
		return input.Mode == nil
	}
	directory := info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0
	if input.Kind == "directory" && !directory {
		return input.Mode == nil
	}
	if input.Kind == "link" {
		target, err := os.Readlink(input.location)
		if err != nil {
			return input.Mode == nil
		}
		if target != input.target {
			return false
		}
	}
	typeMode := uint32(0o100000)
	if input.Kind == "link" {
		typeMode = 0o120000
	} else if directory {
		typeMode = 0o040000
	}
	if input.Mode == nil || *input.Mode&0o170000 != typeMode ||
		(*input.Mode&0o200 == 0) != (info.FileAttributes&windows.FILE_ATTRIBUTE_READONLY != 0) ||
		(input.Device != "" && fmt.Sprint(info.VolumeSerialNumber) != input.Device) ||
		(input.Inode != "" && fmt.Sprint(uint64(info.FileIndexHigh)<<32|uint64(info.FileIndexLow)) != input.Inode) {
		return false
	}
	if input.Size != "" && !directory && input.Kind != "link" &&
		fmt.Sprint(uint64(info.FileSizeHigh)<<32|uint64(info.FileSizeLow)) != input.Size {
		return false
	}
	if input.Modified != "" && fmt.Sprint(info.LastWriteTime.Nanoseconds()) != input.Modified {
		return false
	}
	if input.Changed == "" {
		return true
	}
	var basic struct {
		creation, access, modified, changed int64
		attributes                          uint32
		_                                   uint32
	}
	err = windows.GetFileInformationByHandleEx(handle, windows.FileBasicInfo,
		(*byte)(unsafe.Pointer(&basic)), uint32(unsafe.Sizeof(basic)))
	return err == nil && workspaceWindowsTime(basic.changed) == input.Changed
}
