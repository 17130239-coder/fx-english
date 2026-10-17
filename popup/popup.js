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

  let activeTabId = null;

  // Open Studio
  btnOpenStudio.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_studio' }, () => {
      window.close();
    });
  });

  // Check Active Tab Media
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      activeTabId = tab.id;
      chrome.tabs.sendMessage(tab.id, { action: 'get_media_info' }, async (resp) => {
        if (!chrome.runtime.lastError && resp && resp.success) {
          showMedia(resp);
          return;
        }

        // If content script was not yet active on the tab (e.g. extension reloaded without refreshing the page)
        const isYT = tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts/'));
        const isNF = tab.url && tab.url.includes('netflix.com/watch/');

        if (isYT || isNF) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['lib/subtitleParser.js', isNF ? 'content/netflixContent.js' : 'content/youtubeContent.js']
            });

            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'get_media_info' }, (retryResp) => {
                if (!chrome.runtime.lastError && retryResp && retryResp.success) {
                  showMedia(retryResp);
                } else {
                  showFallbackStatus();
                }
              });
            }, 300);
            return;
          } catch (e) {
            showFallbackStatus();
            return;
          }
        }

        showFallbackStatus();
      });
    } else {
      showFallbackStatus();
    }
  } catch (e) {
    showFallbackStatus();
  }

  function showFallbackStatus() {
    // Check if background worker detects any media tab across windows
    chrome.runtime.sendMessage({ action: 'get_active_media_status' }, (res) => {
      if (res && res.isMedia && res.tabId) {
        activeTabId = res.tabId;
        showMedia({
          platform: res.platform,
          title: res.title || 'Movie / Video',
          hasTracks: true,
          selectedTrack: { label: 'English' }
        });
      } else {
        showIdle();
      }
    });
  }

  function showIdle() {
    mediaCard.style.display = 'none';
    idleCard.style.display = 'flex';
  }

  function showMedia(info) {
    idleCard.style.display = 'none';
    mediaCard.style.display = 'flex';

    const isYT = info.platform === 'youtube';
    platformBadge.textContent = isYT ? 'YouTube' : 'Netflix';
    platformBadge.className = `fx-badge ${isYT ? 'fx-badge-yt' : 'fx-badge-nf'}`;

    mediaTitle.textContent = info.title || (isYT ? 'YouTube Video' : 'Netflix Movie');

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

    // Quick Vocab Modal
    btnQuickVocab.onclick = () => {
      if (activeTabId) {
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
