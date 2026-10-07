//go:build !windows && !linux && !darwin

package main

import "errors"

func acquireReference(pid int) (reference, error) {
	return nil, errors.New("no original-lifetime observer backend on this platform")
}
