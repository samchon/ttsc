const box = { name: "ttsc", "not-valid-key": "kept" };

// expect: dotNotation error
const value = box["name"];
const kept = box["not-valid-key"];

JSON.stringify([value, kept]);
