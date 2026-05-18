// JSON-RPC Content-Length framing as used by LSP over stdio. ttscserver
// wraps tsgo's LSP server but sits between it and the editor so it can
// merge plugin diagnostics into outgoing publishDiagnostics and inject
// ttsc-owned code actions. Both legs of the proxy work on raw bytes.
//
// Headers are preserved when read so callers that inspect Content-Type
// or vendor-specific headers can react to them; outgoing frames written
// by WriteFrame include only Content-Length. That is intentional — the
// LSP base protocol marks every other header optional and editors in
// the wild do not require them on server output.
package lspserver

import (
  "bufio"
  "errors"
  "fmt"
  "io"
  "strconv"
  "strings"
)

// ErrFrameClosed reports a clean EOF between frames. Callers use it to
// shut down a pump loop without surfacing an error to the editor.
var ErrFrameClosed = errors.New("lsp: frame stream closed")

// ErrFrameTooLarge reports that a peer announced a Content-Length above
// the safety cap. ttscserver bounds the value defensively so a confused
// editor or compromised pipe cannot drive the proxy OOM with a single
// gigabyte-scale header.
var ErrFrameTooLarge = errors.New("lsp: frame body exceeds maximum size")

// MaxFrameBytes caps Content-Length to 64 MiB. The largest payload the
// LSP base protocol routinely produces is workspace symbol responses
// for very large monorepos; 64 MiB leaves a wide margin over any real
// editor traffic while still capping attacker-supplied lengths.
const MaxFrameBytes = 64 << 20

// FrameReader decodes Content-Length-framed JSON-RPC messages from r. It
// is intentionally permissive about extra headers (we forward whatever the
// peer sent) and strict about the Content-Length value because tsgo's
// upstream writer always emits one.
type FrameReader struct {
  br *bufio.Reader
}

// NewFrameReader wraps r with an internal buffered reader. r is consumed
// lazily; the underlying reader is never closed by the FrameReader.
func NewFrameReader(r io.Reader) *FrameReader {
  return &FrameReader{br: bufio.NewReader(r)}
}

// Read returns the next message body together with the raw header block
// (without trailing CRLFCRLF). The header block is preserved so callers
// that proxy traffic verbatim do not lose Content-Type or vendor headers.
func (fr *FrameReader) Read() (headers string, body []byte, err error) {
  var headerBuf strings.Builder
  contentLength := -1
  for {
    line, lineErr := fr.br.ReadString('\n')
    if lineErr != nil {
      if lineErr == io.EOF && headerBuf.Len() == 0 && line == "" {
        return "", nil, ErrFrameClosed
      }
      return "", nil, fmt.Errorf("lsp: header read: %w", lineErr)
    }
    trimmed := strings.TrimRight(line, "\r\n")
    if trimmed == "" {
      break
    }
    headerBuf.WriteString(line)
    if value, ok := parseContentLength(trimmed); ok {
      contentLength = value
    }
  }
  if contentLength < 0 {
    return "", nil, errors.New("lsp: missing Content-Length header")
  }
  if contentLength > MaxFrameBytes {
    return "", nil, fmt.Errorf("%w (got %d, max %d)", ErrFrameTooLarge, contentLength, MaxFrameBytes)
  }
  body = make([]byte, contentLength)
  if _, err := io.ReadFull(fr.br, body); err != nil {
    return "", nil, fmt.Errorf("lsp: body read: %w", err)
  }
  return headerBuf.String(), body, nil
}

// parseContentLength extracts the integer value of a Content-Length header.
// Header names are case-insensitive per the LSP base protocol; tsgo emits
// "Content-Length" but some clients downcase, so we normalize here.
func parseContentLength(line string) (int, bool) {
  colon := strings.IndexByte(line, ':')
  if colon < 0 {
    return 0, false
  }
  name := strings.TrimSpace(line[:colon])
  if !strings.EqualFold(name, "Content-Length") {
    return 0, false
  }
  value := strings.TrimSpace(line[colon+1:])
  n, err := strconv.Atoi(value)
  if err != nil || n < 0 {
    return 0, false
  }
  return n, true
}

// WriteFrame serializes body with a Content-Length header to w. The header
// uses CRLF line endings to match the LSP base protocol exactly so editors
// that strict-parse the header block (notably VSCode's client) accept the
// message without warnings.
func WriteFrame(w io.Writer, body []byte) error {
  header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(body))
  if _, err := io.WriteString(w, header); err != nil {
    return fmt.Errorf("lsp: header write: %w", err)
  }
  if _, err := w.Write(body); err != nil {
    return fmt.Errorf("lsp: body write: %w", err)
  }
  return nil
}
