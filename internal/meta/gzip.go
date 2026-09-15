package meta

import (
	"bytes"
	"compress/gzip"
	"sync"
)

var gzipPool = sync.Pool{New: func() interface{} { return new(bytes.Buffer) }}

func gzipBytes(src []byte) []byte {
	var buf bytes.Buffer
	w, _ := gzip.NewWriterLevel(&buf, 5)
	_, _ = w.Write(src)
	_ = w.Close()
	return buf.Bytes()
}

// GzipTo writes gzipped src into dst buffer reuse helper (for dynamic responses).
func GzipTo(dst *bytes.Buffer, src []byte) error {
	w, err := gzip.NewWriterLevel(dst, 5)
	if err != nil {
		return err
	}
	if _, err := w.Write(src); err != nil {
		return err
	}
	return w.Close()
}
