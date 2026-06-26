Trace how `Repository.find()` turns `relations` find options into query-builder joins. Follow this intended chain if the source confirms it: `Repository.find` -> `EntityManager.find` -> `SelectQueryBuilder.setFindOptions` -> `applyFindOptions` -> `buildRelations`. Explain how relation paths become join aliases and join attributes.

List the ordered files and symbols, with the evidence for each hop. If any hop is wrong or indirect, say so instead of forcing it. Do not guess; report gaps.
