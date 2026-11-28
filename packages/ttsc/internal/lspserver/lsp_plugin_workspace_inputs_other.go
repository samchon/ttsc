//go:build !linux && !darwin && !windows

package lspserver

import (
	"fmt"
	"os"
)

func initialWorkspaceFileIdentity(input pluginWorkspaceFile) os.FileInfo {
	if input.Mode == nil {
		return nil
	}
	info, _ := input.stat()
	return info
}

func (input pluginWorkspaceFile) stat() (os.FileInfo, error) {
	if input.Kind == "link" {
		return os.Lstat(input.location)
	}
	return os.Stat(input.location)
}

// Compare portable metadata and the file identity observed by this host.
func (input pluginWorkspaceFile) current() bool {
	info, err := input.stat()
	if err != nil || (input.Kind == "directory" && !info.IsDir()) {
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
	if input.Mode == nil || (input.initial != nil && !os.SameFile(input.initial, info)) ||
		(*input.Mode&0o200 == 0) != (info.Mode()&0o200 == 0) {
		return false
	}
	if input.Kind != "link" {
		const nativeType, nativeDirectory, nativeRegular = 0o170000, 0o040000, 0o100000
		switch *input.Mode & nativeType {
		case nativeDirectory:
			if !info.IsDir() {
				return false
			}
		case nativeRegular:
			if !info.Mode().IsRegular() {
				return false
			}
		}
	}
	return (!info.Mode().IsRegular() || input.Size == "" || fmt.Sprint(info.Size()) == input.Size) &&
		(input.Modified == "" || fmt.Sprint(info.ModTime().UnixNano()) == input.Modified)
}
