#!/bin/sh

# Go's Node runner copies its environment into the WASM argv/env area, which
# the linker reserves only 8 KiB for. Build and CI variables belong to the
# native Go process, not this host suite. Keep executable lookup, the Node
# temporary-directory policy and the suite's optional project-root input.
# Delegate all arguments and the exit status to the toolchain's actual runner.
exec env -i \
  PATH="$PATH" \
  TMPDIR="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}" \
  TTSC_WASM_TEST_ROOT="${TTSC_WASM_TEST_ROOT-}" \
  "$@"
