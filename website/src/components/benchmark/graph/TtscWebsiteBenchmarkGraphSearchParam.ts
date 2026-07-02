function initial(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get(name);
}

function href(name: string, value: string): string {
  const params = new URLSearchParams([[name, value]]);
  return `?${params.toString()}`;
}

function write(name: string, value: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

const TtscWebsiteBenchmarkGraphSearchParam = {
  href,
  initial,
  write,
};

export default TtscWebsiteBenchmarkGraphSearchParam;
