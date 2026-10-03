var legacy = 1;
let stable = legacy;
let untouched = legacy;
untouched += 1;

if (typeof stable == "number") {
  JSON.stringify(stable);
}

if (stable == untouched) {
  JSON.stringify(untouched);
}
