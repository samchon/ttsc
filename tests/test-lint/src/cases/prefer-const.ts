// expect: preferConst error
let stable = 1;
let changing = 1;
changing = 2;

for (let i = 0; i < 2; i++) {
  JSON.stringify(i);
}

// expect: preferConst error
for (let item of [1, 2]) {
  JSON.stringify(item);
}

// Destructuring-assignment targets reassign their identifiers, so neither
// `swapLeft` nor `swapRight` is const-able and must stay unflagged.
let swapLeft = 1;
let swapRight = 2;
[swapLeft, swapRight] = [swapRight, swapLeft];

// Object-destructuring assignment reassigns `picked` through a property value.
let picked = 0;
({ picked } = { picked: 9 });

JSON.stringify([stable, changing, swapLeft, swapRight, picked]);
