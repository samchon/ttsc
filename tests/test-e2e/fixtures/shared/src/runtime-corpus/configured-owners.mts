export async function observeConfiguredOwners(): Promise<unknown> {
  // Computed bare requests deliberately keep the two incompatible owners out
  // of the root NodeNext checker population. Every requested node of each family is
  // supplied upfront under one owner, not a project/configuration per case.
  const esnextName: string = "batch-configured-esnext";
  const legacyName: string = "batch-configured-legacy";
  const esnext = await import(esnextName);
  const legacy = await import(legacyName);
  return { esnext: [esnext.hello(), esnext.sentinel, esnext.derived], legacy: legacy.default.values };
}
