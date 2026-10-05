import fs = require("node:fs");

export = (context: {
  plugin: {
    selectionMode: "bare-aba" | "mapped-aba" | "selected-cutoff";
    selectionNearer: string;
    selectionSibling: string;
    fixtureSource: string;
  };
}) => {
  const selected = require(context.plugin.selectionMode === "mapped-aba" ? "#observation-selection" : "batch-observation-selection");
  const churn = context.plugin.selectionMode === "selected-cutoff" ? context.plugin.selectionSibling : context.plugin.selectionNearer;
  fs.mkdirSync(churn);
  fs.rmdirSync(churn);
  return { name: selected, source: context.plugin.fixtureSource, capabilities: { projectContextArgs: true } };
};
