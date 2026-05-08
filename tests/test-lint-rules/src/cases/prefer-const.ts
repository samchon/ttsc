// expect: prefer-const error
let stable = 1;
let changing = 1;
changing = 2;

for (let i = 0; i < 2; i++) {
  JSON.stringify(i);
}

// expect: prefer-const error
for (let item of [1, 2]) {
  JSON.stringify(item);
}

JSON.stringify([stable, changing]);
