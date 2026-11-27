//go:build ttsc_compiler_batch

package compiler

import (
  innerbatch "github.com/microsoft/typescript-go/internal/batch"
)

func beginBatch() (programBound func(), end func()) {
  return innerbatch.Begin()
}

func beginBatchForProgram() (programBound func(), end func()) {
  return beginBatch()
}
