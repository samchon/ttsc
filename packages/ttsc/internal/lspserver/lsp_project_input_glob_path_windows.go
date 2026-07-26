//go:build windows

package lspserver

import (
  "path/filepath"
  "strings"
)

func projectInputGlobMatchesCandidate(
  pattern string,
  candidate string,
) bool {
  resolvedPattern := resolveWindowsProjectInputPath(pattern)
  resolvedCandidate := resolveWindowsProjectInputPath(candidate)
  if !resolvedPattern.found || !resolvedCandidate.found {
    return false
  }
  patternVolume := strings.ToLower(
    filepath.ToSlash(filepath.VolumeName(resolvedPattern.physical)),
  )
  candidateVolume := strings.ToLower(
    filepath.ToSlash(filepath.VolumeName(resolvedCandidate.physical)),
  )
  if patternVolume != candidateVolume {
    return false
  }
  patternSegments, _ := windowsProjectInputSegments(resolvedPattern)
  candidateSegments, candidateSensitivities :=
    windowsProjectInputSegments(resolvedCandidate)
  return matchProjectInputGlob(
    patternSegments,
    candidateSegments,
    candidateSensitivities,
  )
}
