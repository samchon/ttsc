const settings = { theme: "dark", volume: 5 };
const backup = { theme: "light" };

const { theme } = settings;
// expect: unicorn/consistent-destructuring error
const current = settings.theme;
const fallback = backup.theme;
const volume = settings.volume;
void [theme, current, fallback, volume];
