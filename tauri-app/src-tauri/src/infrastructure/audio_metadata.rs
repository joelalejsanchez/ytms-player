use std::path::Path;
use std::process::Command;

use serde_json::Value;

/// Metadatos extraídos de un archivo de audio local mediante `ffprobe`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AudioFileMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration: i64,
}

const SUPPORTED_AUDIO_EXTENSIONS: &[&str] =
    &["mp3", "m4a", "opus", "wav", "flac", "ogg", "aac", "webm"];

/// Valida si la extensión de archivo corresponde a un formato de audio soportado.
pub fn is_supported_audio_extension(ext: &str) -> bool {
    let clean = ext.trim().trim_start_matches('.').to_lowercase();
    SUPPORTED_AUDIO_EXTENSIONS.contains(&clean.as_str())
}

/// Normaliza el nombre base de un archivo para usarlo como identificador local seguro.
pub fn sanitize_local_track_id(file_stem: &str) -> String {
    let sanitized: String = file_stem
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | '\0' => '_',
            _ => c,
        })
        .collect();
    let collapsed = sanitized.replace("..", "_");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        "local-track".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Genera un identificador local único que no colisiona en disco ni en SQLite.
pub fn resolve_unique_local_id(
    tracks_dir: &Path,
    base_id: &str,
    ext: &str,
    exists_in_db: impl Fn(&str) -> bool,
) -> String {
    let clean_ext = ext.trim().trim_start_matches('.');
    if !tracks_dir.join(format!("{base_id}.{clean_ext}")).exists() && !exists_in_db(base_id) {
        return base_id.to_string();
    }

    let mut counter = 2usize;
    loop {
        let candidate = format!("{base_id}-{counter}");
        if !tracks_dir.join(format!("{candidate}.{clean_ext}")).exists()
            && !exists_in_db(&candidate)
        {
            return candidate;
        }
        counter += 1;
    }
}

/// Extrae duración, título y artista de un archivo de audio usando `ffprobe` (si está disponible).
pub fn extract_audio_metadata(path: &Path) -> AudioFileMetadata {
    let output = match Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(path)
        .output()
    {
        Ok(out) if out.status.success() => out,
        _ => return AudioFileMetadata::default(),
    };

    let Ok(json_str) = String::from_utf8(output.stdout) else {
        return AudioFileMetadata::default();
    };

    parse_ffprobe_json(&json_str)
}

/// Intenta extraer la carátula incrustada del archivo de audio hacia `thumb_dest` usando `ffmpeg`.
pub fn extract_embedded_thumbnail(audio_path: &Path, thumb_dest: &Path) -> bool {
    if thumb_dest.exists() {
        return true;
    }

    let status = Command::new("ffmpeg")
        .args(["-y", "-v", "quiet", "-i"])
        .arg(audio_path)
        .args(["-an", "-vcodec", "mjpeg", "-frames:v", "1"])
        .arg(thumb_dest)
        .status();

    matches!(status, Ok(s) if s.success() && thumb_dest.is_file())
}

/// Parsea la salida JSON de `ffprobe` extrayendo título, artista y duración redondeada en segundos.
pub fn parse_ffprobe_json(json_str: &str) -> AudioFileMetadata {
    let Ok(root) = serde_json::from_str::<Value>(json_str) else {
        return AudioFileMetadata::default();
    };

    let format_obj = root.get("format");
    let first_stream = root
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|arr| arr.first());

    let duration = parse_duration_secs(format_obj.and_then(|f| f.get("duration")))
        .or_else(|| parse_duration_secs(first_stream.and_then(|s| s.get("duration"))))
        .unwrap_or(0);

    let format_tags = format_obj.and_then(|f| f.get("tags"));
    let stream_tags = first_stream.and_then(|s| s.get("tags"));

    let title =
        find_tag_ci(format_tags, &["title"]).or_else(|| find_tag_ci(stream_tags, &["title"]));

    let artist = find_tag_ci(
        format_tags,
        &["artist", "album_artist", "performer", "composer"],
    )
    .or_else(|| {
        find_tag_ci(
            stream_tags,
            &["artist", "album_artist", "performer", "composer"],
        )
    });

    AudioFileMetadata {
        title,
        artist,
        duration,
    }
}

fn parse_duration_secs(val: Option<&Value>) -> Option<i64> {
    let secs = match val? {
        Value::String(s) => s.trim().parse::<f64>().ok()?,
        Value::Number(n) => n.as_f64()?,
        _ => return None,
    };
    if secs.is_finite() && secs > 0.0 {
        Some(secs.round() as i64)
    } else {
        None
    }
}

fn find_tag_ci(tags: Option<&Value>, keys: &[&str]) -> Option<String> {
    let map = tags?.as_object()?;
    for target in keys {
        for (k, v) in map {
            if k.eq_ignore_ascii_case(target) {
                if let Some(s) = v.as_str() {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ffprobe_format_tags_and_duration() {
        let sample = r#"{
            "streams": [{ "duration": "214.12" }],
            "format": {
                "duration": "214.68",
                "tags": {
                    "TITLE": "Midnight City",
                    "ARTIST": "M83"
                }
            }
        }"#;

        let meta = parse_ffprobe_json(sample);
        assert_eq!(meta.title.as_deref(), Some("Midnight City"));
        assert_eq!(meta.artist.as_deref(), Some("M83"));
        assert_eq!(meta.duration, 215);
    }

    #[test]
    fn falls_back_to_stream_tags_and_album_artist() {
        let sample = r#"{
            "streams": [{
                "duration": "180.2",
                "tags": {
                    "title": "Stream Title",
                    "album_artist": "Album Artist"
                }
            }],
            "format": {}
        }"#;

        let meta = parse_ffprobe_json(sample);
        assert_eq!(meta.title.as_deref(), Some("Stream Title"));
        assert_eq!(meta.artist.as_deref(), Some("Album Artist"));
        assert_eq!(meta.duration, 180);
    }

    #[test]
    fn handles_invalid_or_empty_ffprobe_json() {
        assert_eq!(parse_ffprobe_json("not-json"), AudioFileMetadata::default());
        assert_eq!(parse_ffprobe_json("{}"), AudioFileMetadata::default());
    }

    #[test]
    fn sanitizes_local_track_id_safely() {
        assert_eq!(
            sanitize_local_track_id("  My / Song..mp3 "),
            "My _ Song_mp3"
        );
        assert_eq!(sanitize_local_track_id("   "), "local-track");
    }
}
