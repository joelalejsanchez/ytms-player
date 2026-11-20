use std::time::Duration;

use serde::Serialize;

use crate::domain::entities::{
    HealthStatusDto, LikeSyncResponseDto, MicroserviceDownloadRequest,
    MicroserviceDownloadResponse, OAuthStatusDto, SearchResponseDto, SearchResultItemDto,
};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::ports::MicroserviceClientPort;

/// Cliente HTTP hacia el microservicio Go (`POST /api/download`, `POST /api/sync-likes`, `GET /api/health`).
pub struct GoMicroserviceClient {
    base_url: String,
    http_client: reqwest::Client,
}

#[derive(Serialize)]
struct SyncLikesPayload<'a> {
    youtube_ids: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    access_token: Option<&'a str>,
}

impl GoMicroserviceClient {
    pub fn new(base_url: &str) -> DomainResult<Self> {
        let trimmed = base_url.trim().trim_end_matches('/').to_string();
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| {
                DomainError::MicroserviceError(format!("Failed to initialize HTTP client: {e}"))
            })?;

        Ok(Self {
            base_url: trimmed,
            http_client,
        })
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn block_on<F, T>(future: F) -> DomainResult<T>
    where
        F: std::future::Future<Output = DomainResult<T>>,
    {
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            tokio::task::block_in_place(|| handle.block_on(future))
        } else {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|e| {
                    DomainError::MicroserviceError(format!("Failed to create Tokio runtime: {e}"))
                })?;
            rt.block_on(future)
        }
    }
}

impl MicroserviceClientPort for GoMicroserviceClient {
    fn trigger_download(
        &self,
        req: &MicroserviceDownloadRequest,
    ) -> DomainResult<MicroserviceDownloadResponse> {
        let url = format!("{}/api/download", self.base_url);
        let client = self.http_client.clone();

        Self::block_on(async move {
            let resp = client.post(&url).json(req).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("POST /api/download failed: {e}"))
            })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(DomainError::MicroserviceError(format!(
                    "Go microservice returned HTTP {status}: {body}"
                )));
            }

            resp.json::<MicroserviceDownloadResponse>()
                .await
                .map_err(|e| {
                    DomainError::MicroserviceError(format!(
                        "Failed to deserialize /api/download response: {e}"
                    ))
                })
        })
    }

    fn sync_likes(
        &self,
        youtube_ids: &[String],
        access_token: Option<&str>,
    ) -> DomainResult<LikeSyncResponseDto> {
        let url = format!("{}/api/sync-likes", self.base_url);
        let client = self.http_client.clone();
        let payload = SyncLikesPayload {
            youtube_ids,
            access_token,
        };

        Self::block_on(async move {
            let resp = client.post(&url).json(&payload).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("POST /api/sync-likes failed: {e}"))
            })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(DomainError::MicroserviceError(format!(
                    "Go microservice /api/sync-likes returned HTTP {status}: {body}"
                )));
            }

            resp.json::<LikeSyncResponseDto>().await.map_err(|e| {
                DomainError::MicroserviceError(format!(
                    "Failed to deserialize /api/sync-likes response: {e}"
                ))
            })
        })
    }

    fn check_health(&self) -> DomainResult<HealthStatusDto> {
        let url = format!("{}/api/health", self.base_url);
        let client = self.http_client.clone();

        Self::block_on(async move {
            let resp = client.get(&url).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("GET /api/health failed: {e}"))
            })?;

            if !resp.status().is_success() {
                return Err(DomainError::MicroserviceError(format!(
                    "Healthcheck failed with status {}",
                    resp.status()
                )));
            }

            resp.json::<HealthStatusDto>().await.map_err(|e| {
                DomainError::MicroserviceError(format!(
                    "Failed to deserialize /api/health response: {e}"
                ))
            })
        })
    }

    fn get_oauth_status(&self) -> DomainResult<OAuthStatusDto> {
        let url = format!("{}/api/oauth/status", self.base_url);
        let client = self.http_client.clone();

        Self::block_on(async move {
            let resp = client.get(&url).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("GET /api/oauth/status failed: {e}"))
            })?;

            if !resp.status().is_success() {
                return Err(DomainError::MicroserviceError(format!(
                    "OAuth status check failed with status {}",
                    resp.status()
                )));
            }

            resp.json::<OAuthStatusDto>().await.map_err(|e| {
                DomainError::MicroserviceError(format!(
                    "Failed to deserialize /api/oauth/status response: {e}"
                ))
            })
        })
    }

    fn preview_url(
        &self,
        raw_url: &str,
        start: Option<u32>,
        end: Option<u32>,
    ) -> DomainResult<crate::domain::entities::PlaylistPreviewDto> {
        let url = format!("{}/api/download/preview", self.base_url);
        let client = self.http_client.clone();
        let target = raw_url.to_string();

        Self::block_on(async move {
            let mut query = vec![("url".to_string(), target)];
            if let Some(s) = start {
                query.push(("start".to_string(), s.to_string()));
            }
            if let Some(e) = end {
                query.push(("end".to_string(), e.to_string()));
            }
            let resp = client
                .get(&url)
                .query(&query)
                .send()
                .await
                .map_err(|e| {
                    DomainError::MicroserviceError(format!("GET /api/download/preview failed: {e}"))
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(DomainError::MicroserviceError(format!(
                    "Preview failed with HTTP {status}: {body}"
                )));
            }

            resp.json::<crate::domain::entities::PlaylistPreviewDto>()
                .await
                .map_err(|e| {
                    DomainError::MicroserviceError(format!(
                        "Failed to deserialize preview response: {e}"
                    ))
                })
        })
    }

    fn logout_oauth(&self) -> DomainResult<()> {
        let url = format!("{}/api/oauth/logout", self.base_url);
        let client = self.http_client.clone();

        Self::block_on(async move {
            let resp = client.post(&url).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("POST /api/oauth/logout failed: {e}"))
            })?;

            if !resp.status().is_success() {
                return Err(DomainError::MicroserviceError(format!(
                    "OAuth logout failed with status {}",
                    resp.status()
                )));
            }
            Ok(())
        })
    }

    fn rate_video(&self, youtube_id: &str, rating: &str) -> DomainResult<()> {
        let url = format!("{}/api/rate-video", self.base_url);
        let client = self.http_client.clone();
        let payload = serde_json::json!({
            "youtube_id": youtube_id,
            "rating": rating,
        });

        Self::block_on(async move {
            let resp = client.post(&url).json(&payload).send().await.map_err(|e| {
                DomainError::MicroserviceError(format!("POST /api/rate-video failed: {e}"))
            })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(DomainError::MicroserviceError(format!(
                    "Rate video failed with HTTP {status}: {body}"
                )));
            }
            Ok(())
        })
    }

    fn search_tracks(&self, query: &str) -> DomainResult<Vec<SearchResultItemDto>> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        let url = format!("{}/api/search", self.base_url);
        let client = self.http_client.clone();
        let query_str = trimmed.to_string();

        Self::block_on(async move {
            let resp = client
                .get(&url)
                .query(&[("q", &query_str)])
                .send()
                .await
                .map_err(|e| {
                    DomainError::MicroserviceError(format!("GET /api/search failed: {e}"))
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(DomainError::MicroserviceError(format!(
                    "Go microservice /api/search returned HTTP {status}: {body}"
                )));
            }

            let search_resp = resp.json::<SearchResponseDto>().await.map_err(|e| {
                DomainError::MicroserviceError(format!(
                    "Failed to deserialize /api/search response: {e}"
                ))
            })?;

            Ok(search_resp.results)
        })
    }
}
