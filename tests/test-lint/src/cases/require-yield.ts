// expect: requireYield error
function* gen() {
  return 1;
}
JSON.stringify(gen);
