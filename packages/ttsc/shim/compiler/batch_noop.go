//go:build !ttsc_compiler_batch

package compiler

func beginBatch() (programBound func(), end func()) {
  return func() {}, func() {}
}
