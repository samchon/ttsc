// Package configoverlay presents a generated config at its semantic location.
package configoverlay

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/microsoft/typescript-go/shim/tspath"
	"github.com/microsoft/typescript-go/shim/vfs"
)

const overlayEnv = "TTSC_PRIVATE_CONFIG_OVERLAY"

// Open anchors one generated config beside its owner for the native parser.
// The physical config remains in the runtime's owned storage. Only the exact
// config request in the channel can open this read-only view.
//
// @evidence contracts/common.md#principled-implementation A matching absolute request projects the generated config's text beside the original config through the native VFS, preserving the generated file list and the original type lookup directory.
// @evidence contracts/common.md#clear-and-simple-design Open validates the transport and selects the virtual address. The wrapper serves just that file and delegates all other reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unrelated requests keep the original filesystem. Invalid paths, an occupied virtual location or an unreadable config cannot create an overlay.
// @evidence contracts/common.md#meaningful-documentation The comment states the request match, virtual anchor and physical storage ownership.
// @evidence contracts/portability.md#os-neutral-implementation Native absolute paths and the compiler filesystem's case policy determine the matching request and virtual location.
// @evidence contracts/performance.md#efficient-algorithms An absent channel returns immediately. An active channel parses its two paths and opens one config after fixed existence queries. Work follows the path and config text lengths.
// @evidence contracts/performance.md#reuse-equivalent-work Repeated reads within one overlay use its captured config text. Each new request observes current paths and config bytes.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned filesystem holds one config string for the compiler invocation. Open acquires no handle and creates no disk entry.
func Open(fs vfs.FS, cwd, request string) (vfs.FS, string, error) {
	encoded := os.Getenv(overlayEnv)
	if encoded == "" {
		return fs, request, nil
	}
	var paths [2]string
	if err := json.Unmarshal([]byte(encoded), &paths); err != nil {
		return nil, "", fmt.Errorf("private config overlay: %w", err)
	}
	physical, owner := paths[0], paths[1]
	if !filepath.IsAbs(physical) || !filepath.IsAbs(owner) {
		return nil, "", fmt.Errorf("private config overlay paths must be absolute")
	}
	caseSensitivity := vfs.CaseSensitivityOf(fs)
	config := tspath.RootedFilePathFromAbsolute(physical)
	requested := tspath.ToRootedFilePath(request, tspath.RootedDirectoryPath(cwd))
	if tspath.CompareFilePaths(caseSensitivity, requested, config) != 0 {
		return fs, request, nil
	}
	virtual := tspath.RootedFilePathFromAbsolute(filepath.Join(filepath.Dir(owner), filepath.Base(physical)))
	if fs.FileExists(virtual) || fs.DirectoryExists(tspath.RootedDirectoryPath(virtual)) {
		return nil, "", fmt.Errorf("private config overlay path is occupied: %s", virtual)
	}
	text, ok := fs.ReadFile(config)
	if !ok {
		return nil, "", fmt.Errorf("cannot read private config overlay: %s", config)
	}
	return overlayFS{FS: fs, path: virtual, text: text}, string(virtual), nil
}

type overlayFS struct {
	vfs.FS
	path tspath.RootedFilePath
	text string
}

func (f overlayFS) FileExists(path tspath.RootedFilePath) bool {
	return path == f.path || f.FS.FileExists(path)
}

func (f overlayFS) ReadFile(path tspath.RootedFilePath) (string, bool) {
	if path == f.path {
		return f.text, true
	}
	return f.FS.ReadFile(path)
}
