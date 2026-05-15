async function bad(): Promise<number> {
  // expect: await-thenable error
  return await 42;
}
JSON.stringify(bad);
