package evidence

import (
  "regexp"
  "strings"
)

var swaggerURLCandidate = regexp.MustCompile(`(?i)^(?:[A-Za-z][A-Za-z0-9+.-]*://|https?:)`)
var swaggerURLInMessage = regexp.MustCompile(`(?i)(?:[A-Za-z][A-Za-z0-9+.-]*://|https?:/*)[^\s"']+`)
var swaggerURLUser = regexp.MustCompile(`(?i)^((?:[A-Za-z][A-Za-z0-9+.-]*://|https?:/*))[^/]*@`)

// displaySwaggerSource removes URL credentials, query values and fragments
// before validation too. Lexical presentation retains malformed hosts and paths
// without admitting them as valid sources; local file spellings stay unchanged.
// Source identities and cache keys never pass through this function.
func displaySwaggerSource(source string) string {
  candidate := strings.TrimSpace(source)
  if !swaggerURLCandidate.MatchString(candidate) {
    return source
  }
  fragment := strings.IndexByte(candidate, '#')
  if fragment >= 0 {
    candidate = candidate[:fragment]
  }
  query := strings.IndexByte(candidate, '?')
  if query >= 0 {
    candidate = candidate[:query]
  }
  candidate = swaggerURLUser.ReplaceAllString(candidate, "${1}<redacted>@")
  if query >= 0 {
    candidate += "?<redacted>"
  }
  if fragment >= 0 {
    candidate += "#<redacted>"
  }
  return candidate
}

// swaggerSafeMessage sanitizes configured and lower-level redirect URLs at the
// diagnostic boundary. Exact replacement handles malformed whitespace-bearing
// input before scanning repeated URL tokens. Local errors retain their text.
func swaggerSafeMessage(message string, source string) string {
  candidate := strings.TrimSpace(source)
  if !swaggerURLCandidate.MatchString(candidate) {
    return message
  }
  message = strings.ReplaceAll(message, source, displaySwaggerSource(candidate))
  if candidate != source {
    message = strings.ReplaceAll(message, candidate, displaySwaggerSource(candidate))
  }
  return swaggerURLInMessage.ReplaceAllStringFunc(message, displaySwaggerSource)
}
