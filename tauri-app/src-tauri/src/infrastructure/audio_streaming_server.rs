use std::net::SocketAddr;
use std::path::Path;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use url::Url;

/// Servidor HTTP embebido local de alto rendimiento para streaming de audio mediante HTTP 206 Partial Content (Byte-Range).
pub struct AudioStreamingServer {
    port: u16,
}

impl AudioStreamingServer {
    /// Inicia el servidor HTTP en una dirección local efímera `127.0.0.1:0`.
    /// Retorna la instancia con el puerto asignado por el sistema operativo.
    pub fn bind() -> Result<(Self, std::net::TcpListener), std::io::Error> {
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        std_listener.set_nonblocking(true)?;
        let port = std_listener.local_addr()?.port();
        Ok((Self { port }, std_listener))
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Ejecuta el bucle de aceptación asíncrono sobre el socket del servidor.
    pub async fn run(std_listener: std::net::TcpListener) {
        let listener = match TcpListener::from_std(std_listener) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[audio_stream_server] Error al inicializar TcpListener Tokio: {e}");
                return;
            }
        };

        let addr = listener.local_addr().unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], 0)));
        println!("[audio_stream_server] Servidor nativo de streaming iniciado en http://{addr}");

        loop {
            match listener.accept().await {
                Ok((mut socket, _)) => {
                    tokio::spawn(async move {
                        let _ = handle_client(&mut socket).await;
                    });
                }
                Err(e) => {
                    eprintln!("[audio_stream_server] Error al aceptar conexión: {e}");
                }
            }
        }
    }
}

/// Parsea el encabezado Range (ej. "bytes=1048576-2097151" o "bytes=1048576-").
pub fn parse_range(range_header: &str, total_len: u64) -> Option<(u64, u64)> {
    if total_len == 0 {
        return None;
    }
    let s = range_header.trim();
    let prefix = "bytes=";
    if !s.to_ascii_lowercase().starts_with(prefix) {
        return None;
    }
    let spec = s[prefix.len()..].trim();
    let (start_str, end_str) = spec.split_once('-')?;
    let start_str = start_str.trim();
    let end_str = end_str.trim();

    if start_str.is_empty() {
        // Formato sufijo: bytes=-500 (los últimos 500 bytes)
        let suffix: u64 = end_str.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = total_len.saturating_sub(suffix);
        let end = total_len.saturating_sub(1);
        Some((start, end))
    } else {
        let start: u64 = start_str.parse().ok()?;
        if start >= total_len {
            return None;
        }
        let end = if end_str.is_empty() {
            total_len.saturating_sub(1)
        } else {
            let parsed_end: u64 = end_str.parse().ok()?;
            parsed_end.min(total_len.saturating_sub(1))
        };
        if start <= end {
            Some((start, end))
        } else {
            None
        }
    }
}

/// Determina el MIME Type de audio correspondiente a la extensión de archivo.
pub fn get_audio_mime(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "mp3" => Some("audio/mpeg"),
        "m4a" => Some("audio/mp4"),
        "opus" => Some("audio/ogg"),
        "ogg" => Some("audio/ogg"),
        "wav" => Some("audio/wav"),
        "flac" => Some("audio/flac"),
        "webm" => Some("audio/webm"),
        "aac" => Some("audio/aac"),
        _ => None,
    }
}

async fn handle_client(socket: &mut TcpStream) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 4096];
    let n = socket.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }

    let request_str = String::from_utf8_lossy(&buf[..n]);
    let mut lines = request_str.lines();
    let request_line = match lines.next() {
        Some(line) => line,
        None => return Ok(()),
    };

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        send_error_response(socket, 400, "Bad Request", "Malformed request line").await?;
        return Ok(());
    }

    let method = parts[0];
    let uri = parts[1];

    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\n\
                    Access-Control-Allow-Origin: *\r\n\
                    Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
                    Access-Control-Allow-Headers: Range, Content-Type, Accept-Ranges\r\n\
                    Connection: close\r\n\r\n";
        socket.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    if method != "GET" && method != "HEAD" {
        send_error_response(socket, 405, "Method Not Allowed", "Only GET, HEAD, OPTIONS allowed").await?;
        return Ok(());
    }

    let parsed_url = match Url::parse(&format!("http://127.0.0.1{uri}")) {
        Ok(u) => u,
        Err(_) => {
            send_error_response(socket, 400, "Bad Request", "Invalid URL").await?;
            return Ok(());
        }
    };

    if parsed_url.path() != "/stream" {
        send_error_response(socket, 404, "Not Found", "Endpoint not found").await?;
        return Ok(());
    }

    let file_path = match parsed_url.query_pairs().find(|(k, _)| k == "path") {
        Some((_, v)) => v.to_string(),
        None => {
            send_error_response(socket, 400, "Bad Request", "Missing 'path' query parameter").await?;
            return Ok(());
        }
    };

    let path = Path::new(&file_path);
    if !path.is_file() {
        send_error_response(socket, 404, "Not Found", "Audio file not found").await?;
        return Ok(());
    }

    let mime = match get_audio_mime(path) {
        Some(m) => m,
        None => {
            send_error_response(socket, 403, "Forbidden", "Only audio formats (.mp3, .m4a, .opus, .ogg, .wav, .flac) are allowed").await?;
            return Ok(());
        }
    };

    let metadata = match tokio::fs::metadata(path).await {
        Ok(m) => m,
        Err(_) => {
            send_error_response(socket, 500, "Internal Server Error", "Could not read file metadata").await?;
            return Ok(());
        }
    };
    let total_len = metadata.len();

    // Extraer cabecera Range
    let mut range_header = None;
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((name, val)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("range") {
                range_header = Some(val.trim());
                break;
            }
        }
    }

    if let Some(range_val) = range_header {
        match parse_range(range_val, total_len) {
            Some((start, end)) => {
                let content_len = end - start + 1;
                let headers = format!(
                    "HTTP/1.1 206 Partial Content\r\n\
                     Content-Type: {mime}\r\n\
                     Content-Length: {content_len}\r\n\
                     Content-Range: bytes {start}-{end}/{total_len}\r\n\
                     Accept-Ranges: bytes\r\n\
                     Access-Control-Allow-Origin: *\r\n\
                     Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
                     Cache-Control: no-cache, no-store\r\n\
                     Connection: close\r\n\r\n"
                );
                socket.write_all(headers.as_bytes()).await?;

                if method == "GET" {
                    let mut file = tokio::fs::File::open(path).await?;
                    file.seek(std::io::SeekFrom::Start(start)).await?;
                    let mut limited = file.take(content_len);
                    let _ = tokio::io::copy(&mut limited, socket).await;
                }
            }
            None => {
                let headers = format!(
                    "HTTP/1.1 416 Range Not Satisfiable\r\n\
                     Content-Range: bytes */{total_len}\r\n\
                     Content-Length: 0\r\n\
                     Accept-Ranges: bytes\r\n\
                     Access-Control-Allow-Origin: *\r\n\
                     Connection: close\r\n\r\n"
                );
                socket.write_all(headers.as_bytes()).await?;
            }
        }
    } else {
        let headers = format!(
            "HTTP/1.1 200 OK\r\n\
             Content-Type: {mime}\r\n\
             Content-Length: {total_len}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Access-Control-Expose-Headers: Content-Length, Accept-Ranges\r\n\
             Cache-Control: no-cache, no-store\r\n\
             Connection: close\r\n\r\n"
        );
        socket.write_all(headers.as_bytes()).await?;

        if method == "GET" {
            let mut file = tokio::fs::File::open(path).await?;
            let _ = tokio::io::copy(&mut file, socket).await;
        }
    }

    Ok(())
}

async fn send_error_response(
    socket: &mut TcpStream,
    status_code: u16,
    status_text: &str,
    message: &str,
) -> Result<(), std::io::Error> {
    let body = format!("{status_code} {status_text}: {message}\n");
    let resp = format!(
        "HTTP/1.1 {status_code} {status_text}\r\n\
         Content-Type: text/plain; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Connection: close\r\n\r\n\
         {body}",
        body.len()
    );
    socket.write_all(resp.as_bytes()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_range_valid() {
        assert_eq!(parse_range("bytes=0-499", 1000), Some((0, 499)));
        assert_eq!(parse_range("bytes=500-", 1000), Some((500, 999)));
        assert_eq!(parse_range("bytes=0-", 1000), Some((0, 999)));
        assert_eq!(parse_range("bytes=-200", 1000), Some((800, 999)));
        assert_eq!(parse_range("bytes=950-1500", 1000), Some((950, 999)));
    }

    #[test]
    fn test_parse_range_invalid() {
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("bytes=1500-2000", 1000), None);
        assert_eq!(parse_range("bytes=500-400", 1000), None);
        assert_eq!(parse_range("invalid", 1000), None);
        assert_eq!(parse_range("bytes=0-100", 0), None);
    }

    #[test]
    fn test_audio_mime_detection() {
        assert_eq!(get_audio_mime(Path::new("song.mp3")), Some("audio/mpeg"));
        assert_eq!(get_audio_mime(Path::new("track.m4a")), Some("audio/mp4"));
        assert_eq!(get_audio_mime(Path::new("audio.opus")), Some("audio/ogg"));
        assert_eq!(get_audio_mime(Path::new("file.wav")), Some("audio/wav"));
        assert_eq!(get_audio_mime(Path::new("file.flac")), Some("audio/flac"));
        assert_eq!(get_audio_mime(Path::new("doc.pdf")), None);
        assert_eq!(get_audio_mime(Path::new("binary.exe")), None);
    }
}
