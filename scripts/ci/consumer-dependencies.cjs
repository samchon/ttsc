/** Select a consumer's direct dependencies from one complete npm installation. */
function consumerDependencies(installed, specifiers) {
  return Object.fromEntries(specifiers.map((specifier) => {
    const at = specifier.indexOf("@", specifier.startsWith("@") ? 1 : 0);
    const name = at === -1 ? specifier : specifier.slice(0, at);
    if (!Object.hasOwn(installed, name) || typeof installed[name] !== "string")
      throw new Error(`shared installation is missing dependency ${name}`);
    return [name, installed[name]];
  }));
}

module.exports = { consumerDependencies };
