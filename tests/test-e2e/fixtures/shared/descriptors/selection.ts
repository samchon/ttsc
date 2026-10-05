import fs = require("node:fs");

export = (context: {
  plugin: {
    selectionMode: "bare-aba" | "mapped-aba" | "selected-cutoff" | "mapped-record";
    selectionSpecifier?: string;
    selectionNearer: string;
    selectionSibling: string;
    fixtureSource: string;
  };
}) => {
  const selected = require(context.plugin.selectionSpecifier ?? (context.plugin.selectionMode === "mapped-aba" ? "#observation-selection" : "batch-observation-selection"));
  const churn = context.plugin.selectionMode === "selected-cutoff" ? context.plugin.selectionSibling : context.plugin.selectionNearer;
  if (context.plugin.selectionMode !== "mapped-record") {
    fs.mkdirSync(churn);
    fs.rmdirSync(churn);
  }
  return { name: selected, source: context.plugin.fixtureSource, capabilities: { projectContextArgs: true } };
};
