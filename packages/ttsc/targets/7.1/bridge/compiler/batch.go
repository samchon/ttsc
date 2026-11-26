//go:build ttsc_compiler_batch

package compiler

import (
  innerbatch "github.com/microsoft/TypeScript/tsc/internal/batch"
)

func beginBatch() (programBound func(), end func()) {
  return innerbatch.Begin()
}
