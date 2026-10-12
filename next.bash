#!/bin/bash
set -e
pnpm bumpp "$1" --no-commit --no-tag --no-push --recursive --yes
pnpm build
pnpm --filter=./packages/* --filter=!ttsc --filter=!@ttsc/graph -r publish --tag next --access public --no-git-checks
pnpm --filter @ttsc/graph publish --tag next --access public --no-git-checks
pnpm --filter ttsc publish --tag next --access public --no-git-checks
