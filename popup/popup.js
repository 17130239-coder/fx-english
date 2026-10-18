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
  let activeTabUrl = '';

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
      activeTabUrl = tab.url || '';
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
    platformBadge.textContent = isYT ? 'YOUTUBE' : 'NETFLIX';
    const dot = mediaCard.querySelector('.fx-platform-dot');
    if (dot) {
      dot.className = isYT ? 'fx-platform-dot yt' : 'fx-platform-dot';
    }

    mediaTitle.textContent = info.title || (isYT ? 'YouTube Video' : 'Netflix Movie');

    trackStatus.className = 'fx-track-status';
    trackStatus.style.color = '';
    if (info.selectedTrack && info.selectedTrack.label) {
      trackStatus.textContent = (info.selectedTrack.label || 'EN').toUpperCase();
      trackStatus.classList.add('active');
    } else if (info.hasTracks) {
      trackStatus.textContent = 'CC SẴN SÀNG';
      trackStatus.classList.add('active');
    } else {
      trackStatus.textContent = 'CHƯA BẬT CC';
    }

    // Quick Vocab: open Studio directly with extracted subtitles & 4 POS analysis
    btnQuickVocab.onclick = () => {
      if (!activeTabId) return;

      const originalHtml = btnQuickVocab.innerHTML;
      btnQuickVocab.innerHTML = '<span>Đang lấy phụ đề...</span>';
      btnQuickVocab.disabled = true;

      const openStudioWithCues = (cues, title, url) => {
        chrome.storage.local.set({
          fxPendingStudio: {
            title: title || info.title || 'Movie / Video',
            url: url || activeTabUrl || '',
            cues: cues
          }
        }, () => {
          chrome.runtime.sendMessage({ action: 'open_studio' }, () => {
            window.close();
          });
        });
      };

      if (info.platform === 'youtube' && activeTabUrl) {
        chrome.runtime.sendMessage({ action: 'fetch_youtube_captions', url: activeTabUrl }, (ytRes) => {
          if (ytRes && ytRes.success && Array.isArray(ytRes.cues) && ytRes.cues.length > 0) {
            openStudioWithCues(ytRes.cues, ytRes.title, activeTabUrl);
            return;
          }
          queryTabForVocab();
        });
      } else {
        queryTabForVocab();
      }

      function queryTabForVocab() {
        chrome.tabs.sendMessage(activeTabId, { action: 'get_subtitles' }, (res) => {
          if (!chrome.runtime.lastError && res && res.success && res.cues && res.cues.length > 0) {
            openStudioWithCues(res.cues, res.title, res.url);
          } else {
            btnQuickVocab.innerHTML = originalHtml;
            btnQuickVocab.disabled = false;
            const errMsg = res?.error || chrome.runtime.lastError?.message || 'Chưa tìm thấy phụ đề tiếng Anh cho video này. Hãy bật biểu tượng [CC] trên video rồi thử lại.';
            showPopupToast(errMsg, true);
          }
        });
      }
    };

    const showPopupToast = (msg, isError = true) => {
      const toastEl = document.getElementById('fx-popup-toast');
      const dotEl = document.getElementById('fx-popup-toast-dot');
      const msgEl = document.getElementById('fx-popup-toast-msg');
      if (!toastEl || !msgEl) return;

      msgEl.textContent = msg;
      if (dotEl) {
        dotEl.className = isError ? 'fx-popup-toast-dot error' : 'fx-popup-toast-dot success';
      }
      toastEl.style.display = 'flex';
      setTimeout(() => {
        toastEl.style.display = 'none';
      }, 4000);
    };

    const setupDownload = (btn, format) => {
      btn.onclick = () => {
        const originalText = btn.textContent;
        btn.textContent = '...';
        btn.disabled = true;

        chrome.tabs.sendMessage(activeTabId, { action: 'download_subtitles', format }, (res) => {
          btn.textContent = originalText;
          btn.disabled = false;
          if (chrome.runtime.lastError || !res || !res.success) {
            showPopupToast('Lỗi tải phụ đề: ' + (res?.error || chrome.runtime.lastError?.message || 'Không tìm thấy phụ đề. Hãy đảm bảo video có phụ đề tiếng Anh.'), true);
          }
        });
      };
    };

    setupDownload(btnDlSrt, 'srt');
    setupDownload(btnDlVtt, 'vtt');
    setupDownload(btnDlTxt, 'txt');
  }
});
