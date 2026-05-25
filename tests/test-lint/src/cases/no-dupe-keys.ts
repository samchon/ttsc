const o = {
  a: 1,
  // expect: noDupeKeys error
  a: 2,
};
JSON.stringify(o);
