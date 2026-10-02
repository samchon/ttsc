const { pathToFileURL } = require("node:url");

// Each module load has its own error result so one case cannot suppress another.
// Expected values remain literal Go assertions and are never supplied here.
(async () => {
  const inputs = JSON.parse(process.argv[2]);
  const results = [];
  for (const input of inputs) {
    try {
      const loaded = input.esm
        ? await import(pathToFileURL(input.file).href)
        : require(input.file);
      const value = Object.create(null);
      for (const [key, observed] of Object.entries(loaded)) {
        if (typeof observed !== "string") {
          throw new Error(`Export ${key} is ${typeof observed}, expected the fixture's string-export schema`);
        }
        value[key] = observed;
      }
      results.push({ name: input.name, value, error: "" });
    } catch (error) {
      results.push({ name: input.name, value: null, error: String(error.stack || error) });
    }
  }
  process.stdout.write(JSON.stringify(results));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
