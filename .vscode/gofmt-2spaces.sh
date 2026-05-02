#!/usr/bin/env bash
set -euo pipefail

space_indent() {
  perl -pe 's/\t/  /g'
}

# Keep gofmt's parser and spacing decisions, then normalize tabs to two spaces.
if [ "$#" -eq 0 ]; then
  gofmt | space_indent
  exit 0
fi

write=false
for arg in "$@"; do
  if [ "$arg" = "-w" ]; then
    write=true
    break
  fi
done

if [ "$write" = true ]; then
  gofmt "$@"
  files=()
  for arg in "$@"; do
    case "$arg" in
      -* | "") ;;
      *.go) files+=("$arg") ;;
    esac
  done
  if [ "${#files[@]}" -gt 0 ]; then
    perl -0pi -e 's/\t/  /g' "${files[@]}"
  fi
else
  gofmt "$@" | space_indent
fi
