const box = { name: "ttsc", "not-valid-key": "kept" };

// expect: dot-notation error
const value = box["name"];
const kept = box["not-valid-key"];

JSON.stringify([value, kept]);
