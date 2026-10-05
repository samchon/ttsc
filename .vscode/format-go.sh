#!/usr/bin/env bash
set -euo pipefail

# Installed copies and authored test inputs are not formatter-owned source.
# Git's tracked path list also avoids visiting the same file through package links.
git ls-files -z -- \
  ':(glob)packages/**/*.go' ':(glob)experimental/**/*.go' \
  ':!**/fixtures/**' ':!**/testdata/**' |
  xargs -0 -r -n 64 bash ./.vscode/gofmt-2spaces.sh -w
