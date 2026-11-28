package lspserver

import "path/filepath"

// Keep the original bytes and resolve links before any following "..".
func workspacePhysicalDirectory(location string) (string, error) {
  return filepath.EvalSymlinks(location)
}
