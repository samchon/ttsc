Use only this checkout's TypeScript source and graph evidence; do not use web search, external documentation, package docs, or general framework memory.

Trace how `Repository.find()` turns `relations` find options into query-builder joins: `Repository.find` -> `EntityManager.find` -> `SelectQueryBuilder.setFindOptions` -> `applyFindOptions` -> `buildRelations`. Explain how the relation paths are expanded into join aliases and join attributes.
