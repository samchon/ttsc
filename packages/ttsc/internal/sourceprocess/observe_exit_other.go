//go:build !linux && !darwin && !windows

package sourceprocess

import "errors"

func observeExit(_ int) <-chan error {
	finished := make(chan error, 1)
	finished <- errors.New("source-process exit observation is unsupported on this platform")
	return finished
}
