/**
 * FX English - Netflix Injected Script (Runs in page context: MAIN world)
 * Intercepts Netflix manifest & metadata requests to capture direct subtitle track URLs.
 */

(function () {
  'use strict';

  if (window.__fxNetflixInjected) return;
  window.__fxNetflixInjected = true;

  const MANIFEST_PATTERN = /manifest|licensedManifest/i;
  const METADATA_PATTERN = /\/metadata\?/i;
  // Prioritize unsegmented full-movie formats: dfxp-ls-sdh & imsc1.1 over segmented WebVTT
  const ALL_FORMATS = ['dfxp-ls-sdh', 'imsc1.1', 'simplesdh', 'webvtt-lssdh-ios8'];

  let activeVideoData = {
    movieId: null,
    title: '',
    episodeTitle: '',
    season: null,
    episode: null,
    isSeries: false,
    tracks: []
  };

  function dispatchToContent(type, data) {
    try {
      window.dispatchEvent(new CustomEvent('fx_netflix_bridge_event', {
        detail: { type, data }
      }));
    } catch (e) {
      console.warn('[FX Netflix Injected] Dispatch error:', e);
    }
  }

  function processManifestTracks(manifestResult) {
    if (!manifestResult) return;
    const rawTracks = manifestResult.timedtexttracks || manifestResult.textTracks;
    if (!Array.isArray(rawTracks) || rawTracks.length === 0) return;

    if (manifestResult.movieId) activeVideoData.movieId = manifestResult.movieId;

    const parsedTracks = [];

    for (const track of rawTracks) {
      if (track.isNoneTrack) continue;

      const lang = track.language || track.bcp47 || 'unknown';
      const label = track.label || track.displayName || lang;
      const isCC = track.rawTrackType === 'closedcaptions' || Boolean(track.isClosedCaptions);
      const isForced = Boolean(track.isForcedNarrative);

      let downloadUrl = null;
      let format = null;

      const downloadables = track.ttDownloadables || track.downloadables;
      if (downloadables) {
        for (const fmt of ALL_FORMATS) {
          const item = downloadables[fmt];
          if (item) {
            if (item.downloadUrls) {
              const urls = Object.values(item.downloadUrls);
              if (urls.length > 0) {
                downloadUrl = urls[0];
                format = fmt;
                break;
              }
            } else if (Array.isArray(item.urls) && item.urls.length > 0) {
              downloadUrl = item.urls[0].url || item.urls[0];
              format = fmt;
              break;
            }
          }
        }
      }

      if (downloadUrl) {
        parsedTracks.push({
          language: lang,
          label: label,
          isEnglish: lang.toLowerCase().startsWith('en'),
          isClosedCaptions: isCC,
          isForced: isForced,
          downloadUrl: downloadUrl,
          format: format
        });
      }
    }

    if (parsedTracks.length > 0) {
      activeVideoData.tracks = parsedTracks;
      dispatchToContent('tracks_ready', {
        movieId: activeVideoData.movieId,
        title: activeVideoData.title,
        tracks: parsedTracks
      });
    }
  }

  function processMetadata(data) {
    if (!data || !data.video) return;
    const v = data.video;
    activeVideoData.title = v.title || document.title.replace(' - Netflix', '').trim();
    activeVideoData.isSeries = v.type === 'show';

    if (activeVideoData.isSeries && Array.isArray(v.seasons)) {
      for (const season of v.seasons) {
        if (Array.isArray(season.episodes)) {
          for (const ep of season.episodes) {
            if (ep.id === v.currentEpisode) {
              activeVideoData.season = season.seq;
              activeVideoData.episode = ep.seq;
              activeVideoData.episodeTitle = ep.title || '';
              break;
            }
          }
        }
      }
    }

    dispatchToContent('metadata_ready', {
      movieId: v.id || v.currentEpisode,
      title: activeVideoData.title,
      season: activeVideoData.season,
      episode: activeVideoData.episode,
      episodeTitle: activeVideoData.episodeTitle,
      isSeries: activeVideoData.isSeries
    });
  }

  // Intercept JSON.parse & fetch & XMLHttpRequest
  (function (origParse, origFetch, origOpen) {
    JSON.parse = function (text) {
      const data = origParse.apply(this, arguments);
      try {
        if (data && data.result && (data.result.timedtexttracks || data.result.textTracks)) {
          processManifestTracks(data.result);
        }
      } catch (e) {}
      return data;
    };

    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);
      try {
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        if (METADATA_PATTERN.test(url)) {
          const clone = res.clone();
          clone.json().then(processMetadata).catch(() => {});
        } else if (MANIFEST_PATTERN.test(url)) {
          const clone = res.clone();
          clone.json().then((d) => {
            if (d && d.result) processManifestTracks(d.result);
          }).catch(() => {});
        }
      } catch (e) {}
      return res;
    };

    XMLHttpRequest.prototype.open = function (...args) {
      const url = args[1];
      if (typeof url === 'string') {
        if (METADATA_PATTERN.test(url) || MANIFEST_PATTERN.test(url)) {
          this.addEventListener('load', function () {
            try {
              let resp = this.response;
              if (typeof resp === 'string') resp = origParse(resp);
              if (resp) {
                if (METADATA_PATTERN.test(url)) processMetadata(resp);
                if (MANIFEST_PATTERN.test(url) && resp.result) processManifestTracks(resp.result);
              }
            } catch (e) {}
          }, false);
        }
      }
      return origOpen.apply(this, args);
    };
  })(JSON.parse, window.fetch, XMLHttpRequest.prototype.open);

  function extractNetflixMetadata(targetMovieId) {
    try {
      // 1. Check Falcor Cache (Netflix virtual JSON graph)
      const falcor = window.netflix?.falcorCache ||
                     window.netflix?.appContext?.state?.falcorCache ||
                     window.netflix?.appContext?.falcorCache;

      if (falcor && falcor.videos) {
        const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
        const urlId = urlMatch ? urlMatch[1] : null;
        const id = targetMovieId || activeVideoData.movieId || urlId;

        let video = null;
        if (id && falcor.videos[id]) {
          video = falcor.videos[id];
        } else {
          for (const [vId, v] of Object.entries(falcor.videos)) {
            if (v && (v.title || v.summary?.value?.title || v.itemSummary?.value?.title)) {
              video = v;
              if (!activeVideoData.movieId) activeVideoData.movieId = vId;
              break;
            }
          }
        }

        if (video) {
          let title = '';
          if (typeof video.title === 'string') title = video.title;
          else if (video.title?.value && typeof video.title.value === 'string') title = video.title.value;
          else if (video.summary?.value?.title) title = video.summary.value.title;
          else if (video.itemSummary?.value?.title) title = video.itemSummary.value.title;

          // Check ancestor show title (for TV series episodes)
          let showTitle = '';
          if (video.ancestor) {
            const ancId = Array.isArray(video.ancestor) ? video.ancestor[1] : (video.ancestor.value ? video.ancestor.value[1] : null);
            if (ancId && falcor.videos[ancId]) {
              const p = falcor.videos[ancId];
              showTitle = p.title?.value || (typeof p.title === 'string' ? p.title : null) || p.summary?.value?.title || '';
            }
          }

          const s = video.seasonSequence?.value ?? video.seasonSequence;
          const ep = video.episodeSequence?.value ?? video.episodeSequence;

          if (showTitle && showTitle.toLowerCase() !== 'netflix') {
            let full = showTitle;
            if (s !== undefined && ep !== undefined) {
              full += ` S${String(s).padStart(2, '0')}E${String(ep).padStart(2, '0')}`;
            }
            if (title && title !== showTitle) {
              full += ` - ${title}`;
            }
            activeVideoData.title = full;
            return full;
          } else if (title && title.toLowerCase() !== 'netflix') {
            activeVideoData.title = title;
            return title;
          }
        }
      }
    } catch (e) {}

    // 2. Check React playerApp state
    try {
      const playerApp = window.netflix?.appContext?.state?.playerApp;
      if (playerApp && typeof playerApp.getState === 'function') {
        const state = playerApp.getState();
        const playbackState = state?.videoPlayer?.playbackState;
        if (playbackState) {
          for (const k of Object.keys(playbackState)) {
            const item = playbackState[k];
            const t = item?.videoDetails?.title || item?.videoTitle || item?.title;
            if (t && typeof t === 'string' && t.trim() && t.toLowerCase() !== 'netflix') {
              activeVideoData.title = t.trim();
              return activeVideoData.title;
            }
          }
        }
      }
    } catch (e) {}

    // 3. Check DOM elements (Netflix video player controls)
    try {
      const titleEl = document.querySelector('[data-uia="video-title"], .video-title, h4.ellipsize-text');
      if (titleEl) {
        const text = (titleEl.textContent || titleEl.innerText || '').trim();
        if (text && text.toLowerCase() !== 'netflix') {
          const cleaned = text.replace(/\n+/g, ' - ').replace(/\s{2,}/g, ' ');
          activeVideoData.title = cleaned;
          return cleaned;
        }
      }

      // Check Back to Browse button (aria-label: "Back to Browse: Movie Title")
      const backBtn = document.querySelector('button[data-uia="nested-back-button"], a[data-uia="back-to-browse"]');
      if (backBtn) {
        const label = backBtn.getAttribute('aria-label') || '';
        const m = label.match(/:\s*(.+)$/);
        if (m && m[1] && m[1].toLowerCase() !== 'netflix') {
          activeVideoData.title = m[1].trim();
          return activeVideoData.title;
        }
      }

      // Check document.title
      const docClean = (document.title || '')
        .replace(/\s*[-–—|]\s*Netflix.*$/i, '')
        .replace(/^Netflix\s*[-–—|]\s*/i, '')
        .trim();
      if (docClean && docClean.toLowerCase() !== 'netflix') {
        activeVideoData.title = docClean;
        return docClean;
      }
    } catch (e) {}

    return activeVideoData.title;
  }

  // Fallback player check
  function checkPlayerAPI() {
    try {
      const playerApp = window.netflix?.appContext?.state?.playerApp;
      const api = playerApp?.getAPI?.();
      const videoPlayer = api?.videoPlayer;
      const sessionIds = videoPlayer?.getAllPlayerSessionIds?.();
      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        const player = videoPlayer.getVideoPlayerBySessionId(sessionIds[0]);
        const movieId = player?.getMovieId?.();
        if (movieId && !activeVideoData.movieId) {
          activeVideoData.movieId = movieId;
        }

        // Try player.getPlaybackMetadata if available
        if (typeof player?.getPlaybackMetadata === 'function') {
          const pm = player.getPlaybackMetadata();
          if (pm?.title && pm.title.toLowerCase() !== 'netflix') {
            activeVideoData.title = pm.title;
          }
        }

        // Extract tracks directly from player if not already captured
        if (!activeVideoData.tracks || activeVideoData.tracks.length === 0) {
          if (typeof player?.getManifest === 'function') {
            const m = player.getManifest();
            if (m && (m.timedtexttracks || m.textTracks)) {
              processManifestTracks(m);
            }
          }
          if ((!activeVideoData.tracks || activeVideoData.tracks.length === 0) && typeof player?.getTimedTextTrackList === 'function') {
            const list = player.getTimedTextTrackList();
            if (Array.isArray(list) && list.length > 0) {
              processManifestTracks({ movieId: activeVideoData.movieId, timedtexttracks: list });
            }
          }
        }
      }

      // Extract metadata from Falcor or state
      const prevTitle = activeVideoData.title;
      extractNetflixMetadata(activeVideoData.movieId);
      if (activeVideoData.title && activeVideoData.title !== prevTitle && activeVideoData.title.toLowerCase() !== 'netflix') {
        dispatchToContent('metadata_ready', {
          movieId: activeVideoData.movieId,
          title: activeVideoData.title,
          season: activeVideoData.season,
          episode: activeVideoData.episode,
          episodeTitle: activeVideoData.episodeTitle,
          isSeries: activeVideoData.isSeries
        });
      }
    } catch (e) {}
  }

  setInterval(checkPlayerAPI, 2500);

  // Listen for request from content script
  window.addEventListener('fx_netflix_request_info', () => {
    checkPlayerAPI();
    extractNetflixMetadata(activeVideoData.movieId);
    dispatchToContent('tracks_ready', {
      movieId: activeVideoData.movieId,
      title: activeVideoData.title || document.title.replace(/\s*[-–—|]\s*Netflix.*$/i, '').trim(),
      season: activeVideoData.season,
      episode: activeVideoData.episode,
      episodeTitle: activeVideoData.episodeTitle,
      tracks: activeVideoData.tracks
    });
  });

  // Listen for seek command
  window.addEventListener('fx_netflix_seek', (e) => {
    try {
      const seconds = Number(e.detail && e.detail.seconds);
      if (isNaN(seconds) || seconds < 0) return;
      const playerApp = window.netflix?.appContext?.state?.playerApp;
      const sessionIds = playerApp?.getAPI?.()?.videoPlayer?.getAllPlayerSessionIds?.();
      if (sessionIds && sessionIds.length > 0) {
        const player = playerApp.getAPI().videoPlayer.getVideoPlayerBySessionId(sessionIds[0]);
        if (player && typeof player.seek === 'function') {
          player.seek(seconds * 1000);
        }
      }
    } catch (err) {}
  });

  // Initial check
  setTimeout(checkPlayerAPI, 1000);
  setTimeout(checkPlayerAPI, 2500);

  console.log('[FX English] Netflix Injected Script initialized');
})();
