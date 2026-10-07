async function inLoop(): Promise<number> {
  let total = 0;
  for (let i = 0; i < 3; i++) {
    // expect: no-await-in-loop error
    total += await Promise.resolve(1);
  }
  return total;
}
JSON.stringify(inLoop);
