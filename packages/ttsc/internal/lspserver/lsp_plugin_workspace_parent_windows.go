package lspserver

import (
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

var workspaceNTDLL = windows.NewLazySystemDLL("ntdll.dll")
var workspaceQueryDirectoryFile = workspaceNTDLL.NewProc("NtQueryDirectoryFile")
var workspaceQueryVolumeInformationFile = workspaceNTDLL.NewProc("NtQueryVolumeInformationFile")

// The parent directory can still supply the ordinary entry's metadata when
// opening that entry for attributes is denied. Query the single native name,
// rather than enumerating siblings or guessing the volume's case policy.
func windowsWorkspaceParentMetadata(location string) (workspaceWindowsMetadata, bool) {
	parent, name := filepath.Dir(location), filepath.Base(location)
	if parent == location || strings.ContainsAny(name, `*?<>"`) {
		return workspaceWindowsMetadata{}, false
	}
	directory, err := windows.UTF16PtrFromString(parent)
	if err != nil {
		return workspaceWindowsMetadata{}, false
	}
	mask, err := windows.NewNTUnicodeString(name)
	if err != nil {
		return workspaceWindowsMetadata{}, false
	}
	handle, err := windows.CreateFile(directory, windows.FILE_LIST_DIRECTORY,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return workspaceWindowsMetadata{}, false
	}
	defer windows.CloseHandle(handle)
	const fileIDFullDirectoryInformation = 38
	var status windows.IO_STATUS_BLOCK
	var entry struct {
		next, index                                           uint32
		creation, access, modified, changed, size, allocation int64
		attributes, nameLength, eaSize, _                     uint32
		fileID                                                int64
		name                                                  [windows.MAX_PATH]uint16
	}
	result, _, _ := workspaceQueryDirectoryFile.Call(uintptr(handle), 0, 0, 0,
		uintptr(unsafe.Pointer(&status)), uintptr(unsafe.Pointer(&entry)),
		unsafe.Sizeof(entry), fileIDFullDirectoryInformation, 1,
		uintptr(unsafe.Pointer(mask)), 1)
	if code := windows.NTStatus(result); (code != 0 && code != windows.STATUS_BUFFER_OVERFLOW) ||
		status.Information < unsafe.Offsetof(entry.name) || entry.nameLength == 0 ||
		entry.attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
		return workspaceWindowsMetadata{}, false
	}
	// Query the volume from the same list-only handle. A label that does
	// not fit in this header does not affect the serial number.
	const fileFsVolumeInformation = 1
	var volume struct {
		creation            int64
		serial, labelLength uint32
		supportsObjects     uint8
		label               [1]uint16
	}
	status = windows.IO_STATUS_BLOCK{}
	result, _, _ = workspaceQueryVolumeInformationFile.Call(uintptr(handle),
		uintptr(unsafe.Pointer(&status)), uintptr(unsafe.Pointer(&volume)),
		unsafe.Sizeof(volume), fileFsVolumeInformation)
	code := windows.NTStatus(result)
	if status.Status == windows.STATUS_NOT_IMPLEMENTED || code == windows.STATUS_NOT_IMPLEMENTED {
		volume.serial = 0
	} else if uint32(code)>>30 == 3 || status.Information < unsafe.Offsetof(volume.labelLength) {
		return workspaceWindowsMetadata{}, false
	}
	return workspaceWindowsMetadata{
		attributes: entry.attributes,
		device:     volume.serial,
		inode:      uint64(entry.fileID),
		size:       uint64(entry.size),
		modified:   workspaceWindowsNanoseconds(entry.modified),
		changed:    entry.changed,
	}, true
}
