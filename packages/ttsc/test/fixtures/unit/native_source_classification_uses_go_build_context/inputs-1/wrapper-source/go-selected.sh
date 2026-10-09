#!/bin/sh
export GOFLAGS=-tags=ttsc_main
exec "$TTSC_PROBE_REAL_GO" "$@"
