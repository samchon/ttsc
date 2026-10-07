//go:build !linux && !windows

package sourceprocess

// POSIX wait cannot reap another process's child. The direct child is joined
// by exec.Cmd.Wait; group absence is observed separately, and the OS retains
// responsibility for orphan status collection.
func prepareReaper() error { return nil }
func orphanReaping() string { return "os" }
func reapGroup(_ int) error { return nil }
