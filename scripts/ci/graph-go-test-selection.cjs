/**
 * Interpret each owning Go test's declared execution population.
 *
 * Input layers come from the physically separated owning source populations.
 * Public test names retain their package identity even when packages use the
 * same name. The caller verifies these source addresses against Go's
 * platform-aware registered population before executing them. Evidence and the
 * whole source review independently establish acknowledgment truth; this
 * parser does not turn a comment into proof of a portable execution boundary.
 * This private runner helper is not an independently eligible Evidence host.
 */
function graphGoTestAddresses(inputs) {
  const addresses = [];
  const seen = new Set();
  for (const { package: pkg, file, source, layer } of inputs) {
    if (layer !== "unit" && layer !== "e2e")
      throw new Error(`unknown Graph Go input layer: ${layer} (${file})`);
    for (const match of source.matchAll(
      /^func\s+(Test\w+)\s*\(\s*t\s+\*testing\.T\s*\)/gm,
    )) {
      const name = match[1];
      const key = `${pkg}/${name}`;
      if (seen.has(key)) throw new Error(`duplicate Graph Go address: ${key}`);
      seen.add(key);
      addresses.push({ package: pkg, name, file, layer });
    }
  }
  return addresses;
}

/**
 * Select only registered addresses and preserve an exact per-package identity.
 *
 * Source declarations hidden by Go build constraints are not executed on that
 * platform. Conversely a compiled test missing from the source registry fails
 * rather than being omitted. A layer with no registered cases is also an error.
 * Registration is supplied by the actual Go-list operation in the runner.
 */
function selectGraphGoTests(addresses, registered, layer) {
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown Graph Go test layer: ${layer}`);
  const byKey = new Map(addresses.map((entry) => [`${entry.package}/${entry.name}`, entry]));
  const selected = [];
  const seen = new Set();
  for (const entry of registered) {
    const key = `${entry.package}/${entry.name}`;
    if (seen.has(key)) throw new Error(`duplicate registered Graph Go test: ${key}`);
    seen.add(key);
    const source = byKey.get(key);
    if (!source) throw new Error(`registered Graph Go test has no owning source: ${key}`);
    if (!layer || source.layer === layer) selected.push(source);
  }
  if (!selected.length) throw new Error(`Graph Go selection ran no cases: ${layer ?? "all"}`);
  return selected;
}

module.exports = { graphGoTestAddresses, selectGraphGoTests };
