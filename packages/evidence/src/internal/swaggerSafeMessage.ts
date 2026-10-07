/**
 * Redacts remote URL secrets at the diagnostic boundary without changing source
 * identities, transport addresses or local filesystem errors.
 *
 * Exact configured spellings are replaced before scanning lower-level reasons
 * for other URLs, including redirects. Lexical redaction works before URL
 * validation and removes user information, query values and fragments even from
 * malformed addresses. Host and path remain available to identify the failure.
 *
 * @internal
 */
export const swaggerSafeMessage = (error: unknown, source: string): string => {
  let message = error instanceof Error ? error.message : String(error);
  const candidate = source.trim();
  if (!/^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|https?:)/iu.test(candidate)) return message;
  message = message.replaceAll(source, display(candidate));
  if (candidate !== source)
    message = message.replaceAll(candidate, display(candidate));
  return message.replace(/(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|https?:\/*)[^\s"']+/giu, display);
};

const display = (source: string): string => {
  const fragment = source.indexOf("#");
  const withoutFragment = fragment < 0 ? source : source.slice(0, fragment);
  const query = withoutFragment.indexOf("?");
  const base = query < 0 ? withoutFragment : withoutFragment.slice(0, query);
  return base.replace(/^((?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|https?:\/*))[^/]*@/iu, "$1<redacted>@")
    + (query < 0 ? "" : "?<redacted>")
    + (fragment < 0 ? "" : "#<redacted>");
};
