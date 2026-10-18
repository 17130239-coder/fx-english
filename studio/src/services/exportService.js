/**
 * FX English - Export Service
 * Formats vocabulary and communicative sentences into Anki (.txt tab-separated with HTML) and CSV.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.APP_EXPORT_SERVICE = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  /**
   * Export word and sentence items to Anki TSV format
   * @param {Array<Object>} items
   * @param {string} movieTitle
   * @param {string} filename
   */
  function exportToAnki(items = [], movieTitle = 'fx_vocab', filename = '') {
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[ExportService] Empty items list for Anki export.');
      return false;
    }

    const lines = [
      '#separator:Tab',
      '#html:true',
      '#tags column:6',
      '#deck:FX English::' + (movieTitle.replace(/[^\w\s\-_]/g, '_'))
    ];

    items.forEach((item) => {
      // Communicative Sentence Card
      if (item.sentence) {
        const front = `<div style="font-size:20px; font-weight:bold; color:#1e293b;">"${escapeHtml(item.sentence)}"</div>` +
          (item.highlightPhrase ? `<div style="font-size:14px; color:#475569; margin-top:6px;">Cốt lõi: <b>${escapeHtml(item.highlightPhrase)}</b></div>` : '');

        const back = `<div style="font-size:18px; color:#0f766e; font-weight:bold;">${escapeHtml(item.vietnamese || '')}</div>` +
          (item.usageNote ? `<div style="font-size:13px; color:#64748b; margin-top:8px; font-style:italic;">Ghi chú: ${escapeHtml(item.usageNote)}</div>` : '');

        const tag = (item.tag || 'Sentences').replace(/\s+/g, '_');
        lines.push([front, back, '', '', '', `FX_English ${tag}`].join('\t'));
        return;
      }

      // Vocabulary Word Card
      const word = item.word || '';
      const ipa = item.ipa ? `<span style="color:#64748b; font-size:14px;">${escapeHtml(item.ipa)}</span>` : '';
      const posLabel = item.posLabelVi || item.pos || '';
      const cefr = item.cefr ? `<span style="background:#e2e8f0; color:#334155; padding:2px 6px; border-radius:4px; font-size:12px; font-weight:bold;">${item.cefr}</span>` : '';

      const contextText = item.contexts?.[0]?.text || item.contextSentence || '';
      const escapedContext = escapeHtml(contextText);
      const highlightedContext = escapedContext.replace(
        new RegExp(`\\b(${escapeHtml(word)})\\b`, 'gi'),
        '<b style="color:#2563eb; text-decoration:underline;">$1</b>'
      );

      const front = `<div style="font-size:22px; font-weight:bold; color:#0f172a;">${escapeHtml(word)}</div>` +
        `<div style="margin:4px 0 10px 0;">${ipa} &nbsp; ${cefr}</div>` +
        (contextText ? `<div style="font-size:14px; color:#475569; background:#f8fafc; padding:8px 12px; border-left:3px solid #3b82f6; border-radius:4px; font-style:italic;">"${highlightedContext}"</div>` : '');

      const trans = item.vietnamese || item.translation || '';
      const lemma = (item.lemma && item.lemma !== item.word) ? `<div style="font-size:13px; color:#94a3b8; margin-top:4px;">Từ gốc: ${escapeHtml(item.lemma)}</div>` : '';
      const back = `<div style="font-size:18px; color:#059669; font-weight:600;">${escapeHtml(trans)}</div>` +
        `<div style="font-size:13px; color:#64748b; margin-top:6px;">Loại từ: <b>${escapeHtml(posLabel)}</b> (xuất hiện ${item.frequency || 1} lần trong phim)</div>` +
        lemma;

      const tag = `FX_English ${item.pos || 'Word'}`;
      lines.push([front, back, '', '', '', tag].join('\t'));
    });

    const outputName = filename || `${(movieTitle || 'fx_vocab').replace(/[^\w\-_]/g, '_')}_anki.txt`;
    downloadBlob(lines.join('\n'), outputName, 'text/plain;charset=utf-8');
  }

  /**
   * Export word and sentence items to standard CSV format
   * @param {Array<Object>} items
   * @param {string} movieTitle
   * @param {string} filename
   */
  function exportToCsv(items = [], movieTitle = 'fx_vocab', filename = '') {
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[ExportService] Empty items list for CSV export.');
      return false;
    }

    const rows = [
      ['"Từ vựng / Câu"', '"Loại từ"', '"Cấp độ CEFR"', '"Phiên âm IPA"', '"Nghĩa tiếng Việt"', '"Tần suất"', '"Câu ngữ cảnh trong phim"'].join(',')
    ];

    items.forEach((item) => {
      if (item.sentence) {
        rows.push([
          `"${(item.sentence || '').replace(/"/g, '""')}"`,
          `"${(item.tag || 'Câu hay').replace(/"/g, '""')}"`,
          `"Giao tiếp"`,
          `""`,
          `"${(item.vietnamese || '').replace(/"/g, '""')}"`,
          `"${item.frequency || 1}"`,
          `"${(item.usageNote || '').replace(/"/g, '""')}"`
        ].join(','));
        return;
      }

      const contextText = item.contexts?.[0]?.text || item.contextSentence || '';
      rows.push([
        `"${(item.word || '').replace(/"/g, '""')}"`,
        `"${(item.posLabelVi || item.pos || '').replace(/"/g, '""')}"`,
        `"${(item.cefr || '').replace(/"/g, '""')}"`,
        `"${(item.ipa || '').replace(/"/g, '""')}"`,
        `"${(item.vietnamese || item.translation || '').replace(/"/g, '""')}"`,
        `"${item.frequency || 1}"`,
        `"${contextText.replace(/"/g, '""')}"`
      ].join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n'); // Add UTF-8 BOM for Excel
    const outputName = filename || `${(movieTitle || 'fx_vocab').replace(/[^\w\-_]/g, '_')}.csv`;
    downloadBlob(csvContent, outputName, 'text/csv;charset=utf-8');
  }

  return {
    exportToAnki,
    exportToCsv,
    escapeHtml,
    downloadBlob
  };
});
