// expect: no-var error
for (var index = 0; index < 1; index += 1) {
  JSON.stringify(index);
}

// expect: no-var error
for (var key in { value: 1 }) {
  JSON.stringify(key);
}

// expect: no-var error
for (var value of [1]) {
  JSON.stringify(value);
}

for (let safeIndex = 0; safeIndex < 1; safeIndex += 1) {
  JSON.stringify(safeIndex);
}

for (const safeKey in { value: 1 }) {
  JSON.stringify(safeKey);
}

for (const safeValue of [1]) {
  JSON.stringify(safeValue);
}
