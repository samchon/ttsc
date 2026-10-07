void (async () => {
const loaded = await import("./config.js");
console.log(JSON.stringify({
  handler: loaded.handler,
  resolved: loaded.resolved,
  resolvedFromPaths: loaded.resolvedFromPaths,
  target: loaded.target,
  wrapped: loaded.wrapped,
}));
})();
