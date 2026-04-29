#!/bin/bash
set -e
pnpm bumpp "$1" --no-commit --no-tag --no-push --recursive --yes
pnpm build
pnpm --filter=./packages/* --filter=!ttsc -r publish --tag next --access public --no-git-checks
pnpm --filter ttsc publish --tag next --access public --no-git-checks
