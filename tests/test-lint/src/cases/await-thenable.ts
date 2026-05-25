async function bad(): Promise<number> {
  // expect: awaitThenable error
  return await 42;
}
JSON.stringify(bad);
