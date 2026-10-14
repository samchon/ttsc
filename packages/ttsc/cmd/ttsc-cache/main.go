package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type request struct {
	ID       int64
	Command  string
	ActionID []byte
	OutputID []byte
	BodySize int64
}

type response struct {
	ID            int64
	Err           string   `json:",omitempty"`
	KnownCommands []string `json:",omitempty"`
	Miss          bool     `json:",omitempty"`
	OutputID      []byte   `json:",omitempty"`
	Size          int64    `json:",omitempty"`
	DiskPath      string   `json:",omitempty"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "ttsc cache helper:", err)
		os.Exit(1)
	}
}

func run() error {
	rootPath := flag.String("root", "", "owned artifact cache root")
	manifestPath := flag.String("manifest", "", "authenticated publisher manifest")
	manifestDigest := flag.String("manifest-sha256", "", "trusted release metadata digest")
	prepare := flag.Bool("prepare", false, "download and verify selected packs before a Go build")
	packNames := flag.String("packs", "", "comma-separated selected pack names")
	flag.Parse()
	if *rootPath == "" || (*manifestPath == "") != (*manifestDigest == "") || (*prepare && (*manifestPath == "" || *packNames == "")) || (!*prepare && *packNames != "") {
		return errors.New("supply -root and either both publisher manifest arguments or neither")
	}
	var manifest *packageartifacts.Manifest
	if *manifestPath != "" {
		file, err := os.Open(*manifestPath)
		if err != nil {
			return err
		}
		raw, readErr := io.ReadAll(io.LimitReader(file, packageartifacts.MaxManifestBytes+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil {
			return errors.Join(readErr, closeErr)
		}
		decoded, err := packageartifacts.ParseTrustedManifest(raw, *manifestDigest)
		if err != nil {
			return err
		}
		manifest = &decoded
	}
	store, err := openArtifactStore(*rootPath, manifest)
	if err != nil {
		return err
	}
	defer store.close()
	if *prepare {
		receipt, err := preparePacks(context.Background(), store, *manifest, strings.Split(*packNames, ","))
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(receipt)
	}
	return serve(os.Stdin, os.Stdout, store)
}

func serve(source io.Reader, destination io.Writer, store *artifactStore) error {
	input := bufio.NewReaderSize(source, 64<<10)
	output := bufio.NewWriter(destination)
	if err := writeResponse(output, response{KnownCommands: []string{"get", "put", "close"}}); err != nil {
		return err
	}
	for {
		line, err := input.ReadSlice('\n')
		if err != nil {
			return fmt.Errorf("reading Go cache request: %w", err)
		}
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		decoder := json.NewDecoder(bytes.NewReader(line))
		decoder.DisallowUnknownFields()
		var current request
		if err := decoder.Decode(&current); err != nil {
			return fmt.Errorf("decoding Go cache request: %w", err)
		}
		answer := response{ID: current.ID}
		switch current.Command {
		case "get":
			if len(current.ActionID) != 32 {
				answer.Err = "invalid full Go ActionID"
				break
			}
			value, location, found, err := store.get(hex.EncodeToString(current.ActionID))
			if err != nil {
				answer.Err = err.Error()
			} else if !found {
				answer.Miss = true
			} else {
				answer.OutputID, _ = hex.DecodeString(value.OutputID)
				answer.Size = value.Size
				answer.DiskPath = location
			}
		case "put":
			if len(current.ActionID) != 32 || len(current.OutputID) != 32 || current.BodySize < 0 || current.BodySize > 512<<20 {
				return errors.New("invalid full Go cache put identity or body size")
			}
			// Go 1.26 writes an extra newline after the encoded request.
			separator, err := input.ReadByte()
			if err != nil || separator != '\n' {
				return errors.New("missing Go cache request separator")
			}
			var body io.Reader = bytes.NewReader(nil)
			if current.BodySize > 0 {
				quote, err := input.ReadByte()
				if err != nil || quote != '"' {
					return errors.New("missing Go cache body framing")
				}
				encodedLength := ((current.BodySize + 2) / 3) * 4
				body = base64.NewDecoder(base64.StdEncoding, io.LimitReader(input, encodedLength))
			}
			location, putErr := store.put(hex.EncodeToString(current.ActionID), hex.EncodeToString(current.OutputID), current.BodySize, body)
			if current.BodySize > 0 {
				end, err := input.ReadByte()
				if err != nil || end != '"' {
					return errors.New("truncated Go cache body framing")
				}
				end, err = input.ReadByte()
				if err != nil || end != '\n' {
					return errors.New("invalid Go cache body terminator")
				}
			}
			if putErr != nil {
				answer.Err = putErr.Error()
			} else {
				answer.DiskPath = location
			}
		case "close":
			if err := writeResponse(output, answer); err != nil {
				return err
			}
			return nil
		default:
			answer.Err = "unsupported Go cache command"
		}
		if err := writeResponse(output, answer); err != nil {
			return err
		}
	}
}

func writeResponse(output *bufio.Writer, value response) error {
	if err := json.NewEncoder(output).Encode(value); err != nil {
		return err
	}
	return output.Flush()
}
