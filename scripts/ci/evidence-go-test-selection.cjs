/** Keep every discovered Evidence Go case in its owning execution layer. */
function selectEvidenceGoTests(inputs) {
  const layers = { unit: [], e2e: [], windows: [] };
  const sources = {};
  for (const { file, source, layer } of inputs) {
    if (!Object.hasOwn(layers, layer))
      throw new Error(`unknown Evidence Go test layer: ${layer}`);
    for (const match of source.matchAll(/^func (Test[A-Za-z0-9_]+)\s*\(/gm)) {
      const name = match[1];
      if (name === "TestMain") continue;
      if (Object.hasOwn(sources, name))
        throw new Error(`duplicate Evidence Go test: ${name}`);
      sources[name] = file;
      layers[layer].push(name);
    }
  }
  return { ...layers, sources };
}

/** Register the selected original functions as independent named subtests. */
function evidenceGoSelectionSource(names, layer, sources) {
  const wrapper =
    layer === "unit"
      ? "TestSelectedEvidenceUnits"
      : layer === "windows"
        ? "TestSelectedEvidenceWindowsBoundaries"
        : "TestSelectedEvidenceBoundaries";
  return {
    wrapper,
    source: [
      "package evidence",
      "",
      'import "testing"',
      "",
      `func ${wrapper}(t *testing.T) {`,
      ...names.flatMap((name) => [
        `//line ${sources[name]}:1`,
        `  t.Run(${JSON.stringify(name)}, ${name})`,
      ]),
      "//line evidence_layer_selection_test.go:1",
      "}",
      "",
    ].join("\n"),
  };
}

module.exports = { selectEvidenceGoTests, evidenceGoSelectionSource };
