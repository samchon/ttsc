//go:build !windows

package lspserver

import "strings"

func projectInputGlobMatchesCandidate(
  pattern string,
  candidate string,
) bool {
  return matchProjectInputGlob(
    strings.Split(projectInputPathKey(realProjectInputPath(pattern)), "/"),
    strings.Split(projectInputPathKey(realProjectInputPath(candidate)), "/"),
    nil,
  )
}
