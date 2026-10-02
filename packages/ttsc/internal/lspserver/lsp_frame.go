// JSON-RPC Content-Length framing as used by LSP over stdio. ttscserver
// wraps tsgo's LSP server but sits between it and the editor so it can
// merge plugin diagnostics into outgoing publishDiagnostics and inject
// ttsc-owned code actions and executeCommand results. Both legs of the
// proxy work on raw bytes.
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

// ErrFrameTooLarge reports that a peer sent a header block or announced a
// Content-Length above the safety cap. ttscserver bounds both defensively so a
// confused editor or compromised pipe cannot drive the proxy OOM with a single
// gigabyte-scale frame.
var ErrFrameTooLarge = errors.New("lsp: frame exceeds maximum size")

// MaxFrameBytes caps announced Content-Length to 64 MiB before body allocation.
// A larger incoming frame is rejected with ErrFrameTooLarge.
const MaxFrameBytes = 64 << 20

// MaxHeaderBytes caps incoming header scanning to 64 KiB, including optional
// headers, so unknown header population cannot cause unbounded accumulation.
const MaxHeaderBytes = 64 << 10

// FrameReader decodes Content-Length-framed JSON-RPC messages from r. It
// accepts extra headers and returns them separately; the proxy's WriteFrame
// recreates only Content-Length. The caller owns the underlying reader.
//
// @evidence contracts/common.md#principled-implementation A buffered stream reader retains bytes beyond each frame so subsequent frames remain aligned.
// @evidence contracts/common.md#clear-and-simple-design One reader owns framing state without owning transport closure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Extra headers follow protocol tolerance rather than particular editor payloads.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes returned headers, outgoing framing and reader ownership, following the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms Read chooses the framing algorithm; this type carries its buffered input.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The type does not coordinate shared computations across readers.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The transport owner controls closure; this representation owns no native handle independently.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type FrameReader struct {
  br *bufio.Reader
}

// NewFrameReader wraps r with an internal buffered reader. r is consumed
// lazily; the underlying reader is never closed by the FrameReader.
//
// @evidence contracts/common.md#principled-implementation bufio.Reader preserves unread stream bytes across frame boundaries.
// @evidence contracts/common.md#clear-and-simple-design Construction wraps one caller-owned reader and returns framing state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported buffering avoids mutating the foreign reader implementation.
// @evidence contracts/common.md#meaningful-documentation Native prose states lazy consumption and closure ownership, following the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction delegates buffering; Read owns input processing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Distinct streams cannot share unread framing state.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned reader owns its buffer while the caller retains transport closure.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewFrameReader computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewFrameReader(r io.Reader) *FrameReader {
  return &FrameReader{br: bufio.NewReader(r)}
}

// Read returns the next message body together with the raw header block
// (without trailing CRLFCRLF). The header block is preserved so callers
// that proxy traffic verbatim do not lose Content-Type or vendor headers.
//
// @evidence contracts/common.md#principled-implementation Header parsing obtains a nonnegative bounded length and io.ReadFull consumes exactly that body; EOF between frames differs from a truncated frame.
// @evidence contracts/common.md#clear-and-simple-design Header accumulation precedes bounded body allocation, with Content-Length recognition delegated to one helper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Case-insensitive header names and size caps follow framing policy rather than known editor messages.
// @evidence contracts/common.md#meaningful-documentation Native prose states separate header and body returns, following the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms ReadSlice and builders process H header bytes and B body bytes in O(H+B) time and O(H+B) returned/temporary storage, under independent caps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Consuming the next stream frame is effectful and cannot reuse a previous frame's body.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Per-frame buffers are returned to the caller; the transport owner closes the reader.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Read computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (fr *FrameReader) Read() (headers string, body []byte, err error) {
  var headerBuf strings.Builder
  contentLength := -1
  for {
    var lineBuf strings.Builder
    for {
      chunk, lineErr := fr.br.ReadSlice('\n')
      if len(chunk) != 0 {
        if headerBuf.Len()+lineBuf.Len()+len(chunk) > MaxHeaderBytes {
          return "", nil, fmt.Errorf("%w (header got more than %d bytes)", ErrFrameTooLarge, MaxHeaderBytes)
        }
        lineBuf.Write(chunk)
      }
      if lineErr == nil {
        break
      }
      if errors.Is(lineErr, bufio.ErrBufferFull) {
        continue
      }
      if lineErr == io.EOF && headerBuf.Len() == 0 && lineBuf.Len() == 0 {
        return "", nil, ErrFrameClosed
      }
      return "", nil, fmt.Errorf("lsp: header read: %w", lineErr)
    }
    line := lineBuf.String()
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
// that strict-parse the header block (notably VS Code's client) accept the
// message without warnings.
//
// @evidence contracts/common.md#principled-implementation Byte length and CRLF framing delimit the exact body; the writer must obey io.Writer's short-write error contract.
// @evidence contracts/common.md#clear-and-simple-design Header and body are written directly while the caller owns synchronization.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol line endings are legitimate constants, independent of native text conventions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains outgoing header syntax and its reason, following the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Only the length header is allocated; the existing B-byte body is passed directly to the writer without a concatenated frame copy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each frame write is an externally visible transport effect.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function neither retains the body nor takes ownership of the writer.
// @evidenceExclude contracts/portability.md#os-neutral-implementation WriteFrame computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
