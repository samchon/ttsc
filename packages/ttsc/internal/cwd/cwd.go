package cwd

import "fmt"

// Resolve returns an explicit working directory override or asks the host OS
// for the current process directory.
//
// The override is preserved without validation or absolutization; the command
// that consumes it owns those policies. When no override is supplied, getwd
// must be a valid host directory reader. Its failure retains the wrapped cause.
//
// @evidence contracts/common.md#principled-implementation An explicit override wins; otherwise the injected host reader supplies the actual process directory and its error is wrapped without losing identity.
// @evidence contracts/common.md#clear-and-simple-design This boundary chooses the directory source only; path validation and project anchoring remain with the consuming command.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The reader is an explicit dependency, not a replaced global; override precedence is the CLI contract rather than a fixture exception.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state preservation, the conditional reader precondition and wrapped failure effects under the documentation skill's ownership and rationale guidance.
// @evidence contracts/portability.md#os-neutral-implementation The supplied host reader owns native directory discovery. Resolve preserves native spelling rather than imposing separators or inferring a filesystem case policy.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resolve retains no directory handle or cache; the injected reader owns its acquisition and cleanup, and returned directory/error values belong to the caller.
// @evidence contracts/performance.md#efficient-algorithms A nonempty override returns directly. Otherwise one injected directory read supplies its own native cost; failure formatting includes the returned error's text and formatting behavior, not just the fixed branch count.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call selects the supplied override or current reader result; Resolve owns no process-directory snapshot or validity interval for cross-call reuse.
func Resolve(override string, getwd func() (string, error)) (string, error) {
  if override != "" {
    return override, nil
  }
  wd, err := getwd()
  if err != nil {
    return "", fmt.Errorf("could not get working directory: %w", err)
  }
  return wd, nil
}
