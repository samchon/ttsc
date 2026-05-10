package main

import (
	"bytes"
	"testing"
)

// capturePlatformOutput records the platform helper streams around one command.
//
// The platform binary writes through package-level writers so tests do not need
// to patch process-global stdout or stderr. Capturing those writers keeps each
// command scenario hermetic while still exercising the real run and demo paths.
func capturePlatformOutput(t *testing.T, fn func() int) (int, string, string) {
	t.Helper()
	var stdoutBuffer, stderrBuffer bytes.Buffer
	previousStdout, previousStderr := stdout, stderr
	stdout = &stdoutBuffer
	stderr = &stderrBuffer
	defer func() {
		stdout = previousStdout
		stderr = previousStderr
	}()
	code := fn()
	return code, stdoutBuffer.String(), stderrBuffer.String()
}
