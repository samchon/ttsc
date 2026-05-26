async function bad(): Promise<number> {
  // expect: typescript/await-thenable error
  return await 42;
}
JSON.stringify(bad);
