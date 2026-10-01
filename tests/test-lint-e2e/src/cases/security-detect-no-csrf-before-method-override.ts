
express.methodOverride();
express.csrf();
// expect: security/detect-no-csrf-before-method-override error
express.methodOverride();
