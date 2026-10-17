/**
 * FX English - Popup Controller
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const mediaCard = document.getElementById('fx-media-card');
  const idleCard = document.getElementById('fx-idle-card');
  const platformBadge = document.getElementById('fx-platform-badge');
  const trackStatus = document.getElementById('fx-track-status');
  const mediaTitle = document.getElementById('fx-media-title');

  const btnQuickVocab = document.getElementById('fx-btn-quick-vocab');
  const btnDlSrt = document.getElementById('fx-btn-dl-srt');
  const btnDlVtt = document.getElementById('fx-btn-dl-vtt');
  const btnDlTxt = document.getElementById('fx-btn-dl-txt');
  const btnOpenStudio = document.getElementById('fx-btn-open-studio');

  const PARSER = (typeof APP_SUBTITLE_PARSER !== 'undefined') ? APP_SUBTITLE_PARSER : null;

  let activeTabId = null;
  let cachedCues = null;
  let cachedTitle = '';

  // Open Studio
  btnOpenStudio.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_studio' }, () => {
      window.close();
    });
  });

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      const match = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const embedMatch = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return embedMatch[1];
    } catch (e) {}
    return null;
  }

  // Check Active Tab Media
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      activeTabId = tab.id;
      chrome.tabs.sendMessage(tab.id, { action: 'get_media_info' }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.success) {
          showMedia(resp);
          return;
        }

        // Direct YouTube API fallback if content script is not yet active on the tab
        if (tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts/'))) {
          const videoId = extractYouTubeId(tab.url);
          if (videoId) {
            chrome.runtime.sendMessage({ action: 'fetch_youtube_captions', videoId }, (ytRes) => {
              if (ytRes && ytRes.success) {
                cachedCues = ytRes.cues || [];
                cachedTitle = ytRes.title || tab.title || 'YouTube Video';
                showMedia({
                  platform: 'youtube',
                  title: cachedTitle,
                  hasTracks: ytRes.tracks && ytRes.tracks.length > 0,
                  selectedTrack: ytRes.selectedTrack,
                  cues: cachedCues,
                  isDirectFetch: true
                });
                return;
              }
              showIdle();
            });
            return;
          }
        }

        showIdle();
      });
    } else {
      showIdle();
    }
  } catch (e) {
    showIdle();
  }

  function showIdle() {
    mediaCard.style.display = 'none';
    idleCard.style.display = 'flex';
  }

  function downloadContent(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showMedia(info) {
    idleCard.style.display = 'none';
    mediaCard.style.display = 'flex';

    const isYT = info.platform === 'youtube';
    platformBadge.textContent = isYT ? 'YouTube' : 'Netflix';
    platformBadge.className = `fx-badge ${isYT ? 'fx-badge-yt' : 'fx-badge-nf'}`;

    mediaTitle.textContent = info.title || (isYT ? 'YouTube Video' : 'Netflix Movie');
    cachedTitle = mediaTitle.textContent;

    if (info.selectedTrack && info.selectedTrack.label) {
      trackStatus.textContent = `✓ ${info.selectedTrack.label}`;
      trackStatus.style.color = '#34d399';
    } else if (info.hasTracks) {
      trackStatus.textContent = '✓ Có phụ đề';
      trackStatus.style.color = '#34d399';
    } else {
      trackStatus.textContent = 'Chưa bật CC';
      trackStatus.style.color = '#f59e0b';
    }

    // Quick Vocab Modal or Open Studio with cached cues
    btnQuickVocab.onclick = () => {
      if (info.isDirectFetch && cachedCues && cachedCues.length > 0) {
        chrome.storage.local.set({
          fxPendingStudio: {
            title: cachedTitle,
            cues: cachedCues
          }
        }, () => {
          chrome.runtime.sendMessage({ action: 'open_studio' }, () => window.close());
        });
      } else if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: 'open_vocab_modal' }, () => {
          window.close();
        });
      }
    };

    // Subtitle Downloads
    const setupDownload = (btn, format) => {
      btn.onclick = () => {
        const originalText = btn.textContent;
        btn.textContent = '...';
        btn.disabled = true;

        if (info.isDirectFetch && cachedCues && cachedCues.length > 0 && PARSER) {
          const safeTitle = (cachedTitle || 'youtube_subtitles').replace(/[/\\?%*:|"<>]/g, '_');
          let content = '';
          let filename = `${safeTitle}.${format}`;
          let mimeType = 'text/plain;charset=utf-8;';

          if (format === 'srt') {
            content = PARSER.toSRT(cachedCues);
            mimeType = 'application/x-subrip;charset=utf-8;';
          } else if (format === 'vtt') {
            content = PARSER.toWebVTT(cachedCues);
            mimeType = 'text/vtt;charset=utf-8;';
          } else if (format === 'txt') {
            content = PARSER.toReadableTranscript(cachedCues);
          }

          downloadContent(content, filename, mimeType);
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }

        chrome.tabs.sendMessage(activeTabId, { action: 'download_subtitles', format }, (res) => {
          btn.textContent = originalText;
          btn.disabled = false;
          if (chrome.runtime.lastError || !res || !res.success) {
            alert('Lỗi tải phụ đề: ' + (res?.error || chrome.runtime.lastError?.message || 'Không tìm thấy phụ đề. Hãy đảm bảo video có phụ đề tiếng Anh.'));
          }
        });
      };
    };

    setupDownload(btnDlSrt, 'srt');
    setupDownload(btnDlVtt, 'vtt');
    setupDownload(btnDlTxt, 'txt');
  }
});
