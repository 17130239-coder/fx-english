/**
 * AF English - Advanced Vocabulary Analyzer & POS Categorizer
 * Splits subtitle text into Nouns, Verbs, Adjectives, Adverbs with lemmatization,
 * frequency analysis, movie context sentences, timestamps, and CEFR levels.
 * Compatible with Browser, Service Worker, and Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const nlp = require('./compromise.js');
    const cefrDict = require('./cefrDict.js');
    module.exports = factory(nlp, cefrDict);
  } else {
    root.APP_VOCAB_ANALYZER = factory(root.nlp, root.APP_CEFR_DICT);
  }
})(typeof self !== 'undefined' ? self : this, function (nlpInstance, cefrDictInstance) {
  'use strict';

  // Auxiliary verbs to ignore from main lexical verbs list
  const AUXILIARY_VERBS = new Set([
    'be', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
    'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing',
    'can', 'could', 'will', 'would', 'shall', 'should',
    'may', 'might', 'must'
  ]);

  // Common pronouns and determiners that must NEVER be classified as nouns or vocabulary
  const PRONOUN_DETERMINER_BLACKLIST = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their',
    'mine', 'yours', 'hers', 'ours', 'theirs',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
    'this', 'that', 'these', 'those',
    'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever', 'whichever',
    'someone', 'somebody', 'something',
    'anyone', 'anybody', 'anything',
    'everyone', 'everybody', 'everything',
    'no one', 'nobody', 'nothing',
    'none', 'all', 'any', 'some', 'each', 'every', 'either', 'neither',
    'both', 'few', 'fewer', 'many', 'much', 'more', 'most', 'several',
    'other', 'others', 'another', 'such', 'one', 'ones'
  ]);

  // Definite adverbs that rule-based NLP parsers can confuse with nouns or conjunctions
  const KNOWN_ADVERBS = new Set([
    'there', 'here', 'where', 'somewhere', 'anywhere', 'nowhere', 'everywhere',
    'now', 'then', 'today', 'tomorrow', 'yesterday', 'tonight', 'soon',
    'already', 'still', 'yet', 'again', 'ever', 'never', 'always', 'often',
    'sometimes', 'usually', 'seldom', 'rarely', 'also', 'too', 'very', 'quite',
    'really', 'away', 'back', 'together', 'apart', 'ahead', 'abroad',
    'indoors', 'outdoors', 'downstairs', 'upstairs', 'inside', 'outside', 'nearby',
    'almost', 'nearly', 'hardly', 'scarcely', 'barely', 'extremely', 'fairly',
    'pretty', 'rather', 'especially', 'particularly', 'specifically', 'actually',
    'probably', 'maybe', 'perhaps', 'definitely', 'certainly', 'indeed',
    'obviously', 'clearly', 'simply', 'just', 'only', 'even', 'late', 'early',
    'fast', 'hard', 'well', 'anyway', 'instead', 'besides', 'meanwhile',
    'otherwise', 'furthermore', 'moreover', 'nonetheless', 'nevertheless'
  ]);

  // Common high-frequency stopwords that add little value to vocabulary study
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet',
    'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to', 'up', 'with',
    'as', 'if', 'than', 'because', 'while', 'though', 'although',
    'oh', 'ah', 'uh', 'um', 'yeah', 'yes', 'no', 'okay', 'ok', 'hey', 'hi', 'hello',
    'gonna', 'wanna', 'gotta', 'huh', 'wow', 'ooh'
  ]);

  // Curated patterns for high-impact real-life spoken phrases (Phrasal Verbs, Idioms, Collocations, Slang)
  const COMMUNICATIVE_PHRASE_PATTERNS = [
    { pattern: /\b(up to you)\b/i, phrase: "up to you", category: "collocation", tag: "Cụm từ", vi: "Tùy bạn quyết định", note: "Dùng khi trao quyền quyết định cho người đối thoại" },
    { pattern: /\b(make(s)? sense)\b/i, phrase: "make sense", category: "collocation", tag: "Cụm từ", vi: "Hợp lý, có lý, dễ hiểu", note: "Dùng để xác nhận điều gì đó nghe hợp logic" },
    { pattern: /\b(take it easy)\b/i, phrase: "take it easy", category: "idiom", tag: "Thành ngữ", vi: "Bình tĩnh nào, thư giãn đi", note: "Khuyên ai đó bớt căng thẳng hoặc dùng khi chào tạm biệt" },
    { pattern: /\b(no big deal|not a big deal)\b/i, phrase: "no big deal", category: "collocation", tag: "Cụm từ", vi: "Không có gì to tát đâu / Chuyện nhỏ thôi", note: "Dùng trấn an người khác khi có sơ suất" },
    { pattern: /\b(hang in there)\b/i, phrase: "hang in there", category: "idiom", tag: "Thành ngữ", vi: "Cố lên, kiên trì lên nhé", note: "Lời động viên rất phổ biến của người bản xứ" },
    { pattern: /\b(call it a day)\b/i, phrase: "call it a day", category: "idiom", tag: "Thành ngữ", vi: "Hôm nay nghỉ ở đây thôi / Dừng làm việc", note: "Dùng khi kết thúc một ngày làm việc hay học tập" },
    { pattern: /\b(by the way)\b/i, phrase: "by the way", category: "collocation", tag: "Cụm từ", vi: "À mà này, nhân tiện", note: "Dùng để chuyển sang một chủ đề mới trong hội thoại" },
    { pattern: /\b(as a matter of fact|to be honest|to tell (you )?the truth)\b/i, phrase: "to be honest", category: "collocation", tag: "Cụm từ", vi: "Thành thật mà nói, thực tế là", note: "Mở đầu bày tỏ quan điểm thẳng thắn" },
    { pattern: /\b(so far so good)\b/i, phrase: "so far so good", category: "idiom", tag: "Thành ngữ", vi: "Mọi thứ đến giờ vẫn ổn thỏa", note: "Trả lời khi ai đó hỏi tiến độ công việc" },
    { pattern: /\b(keep (it )?up)\b/i, phrase: "keep it up", category: "phrasal_verb", tag: "Động từ ghép", vi: "Cứ tiếp tục phát huy nhé", note: "Khen ngợi và động viên ai đó giữ vững phong độ" },
    { pattern: /\b(out of the blue)\b/i, phrase: "out of the blue", category: "idiom", tag: "Thành ngữ", vi: "Bất ngờ, đột ngột, từ trên trời rơi xuống", note: "Chỉ sự việc xảy ra hoàn toàn không báo trước" },
    { pattern: /\b(sleep on it)\b/i, phrase: "sleep on it", category: "idiom", tag: "Thành ngữ", vi: "Cứ suy nghĩ thêm qua đêm nay / Mai tính tiếp", note: "Khuyên tạm hoãn quyết định để cân nhắc kỹ hơn" },
    { pattern: /\b(give (me|us) a hand|lend (me|us) a hand)\b/i, phrase: "give a hand", category: "idiom", tag: "Thành ngữ", vi: "Giúp tôi một tay với", note: "Cách nhờ giúp đỡ rất tự nhiên và lịch sự" },
    { pattern: /\b(do me a favor)\b/i, phrase: "do me a favor", category: "collocation", tag: "Cụm từ", vi: "Giúp tôi một việc được không", note: "Mở lời khi muốn nhờ ai việc gì quan trọng" },
    { pattern: /\b(let me know)\b/i, phrase: "let me know", category: "collocation", tag: "Cụm từ", vi: "Hãy báo cho tôi biết nhé", note: "Mẫu câu kết thúc trao đổi rất thông dụng" },
    { pattern: /\b(don't worry( about it)?)\b/i, phrase: "don't worry", category: "collocation", tag: "Cụm từ", vi: "Đừng lo lắng, không sao đâu", note: "Trấn an đối phương" },
    { pattern: /\b(have no idea|has no idea|had no idea)\b/i, phrase: "have no idea", category: "idiom", tag: "Thành ngữ", vi: "Hoàn toàn không biết / Không có manh mối nào", note: "Nhấn mạnh sự không biết rõ hơn 'I don't know'" },
    { pattern: /\b(can't wait|couldn't wait)\b/i, phrase: "can't wait", category: "collocation", tag: "Cụm từ", vi: "Háo hức lắm rồi, không thể chờ thêm", note: "Bộc lộ sự phấn khởi trước một sự kiện sắp tới" },
    { pattern: /\b(keep in mind)\b/i, phrase: "keep in mind", category: "collocation", tag: "Cụm từ", vi: "Hãy ghi nhớ điều này", note: "Nhắc nhở lưu ý một điểm quan trọng" },
    { pattern: /\b(fair enough)\b/i, phrase: "fair enough", category: "collocation", tag: "Cụm từ", vi: "Hợp lý đấy / Tôi chấp nhận điều đó", note: "Bày tỏ sự đồng thuận với lập luận của đối phương" },
    { pattern: /\b(you got it)\b/i, phrase: "you got it", category: "slang", tag: "Tiếng lóng", vi: "Có ngay đây / Bạn hiểu đúng rồi đấy", note: "Đáp lại khi nhận lời giúp hoặc xác nhận đúng" },
    { pattern: /\b(it's about time|about time)\b/i, phrase: "it's about time", category: "idiom", tag: "Thành ngữ", vi: "Đến lúc rồi đấy / Cuối cùng cũng xong", note: "Thốt lên khi một việc diễn ra sau thời gian dài chờ đợi" },
    { pattern: /\b(better late than never)\b/i, phrase: "better late than never", category: "idiom", tag: "Thành ngữ", vi: "Muộn còn hơn không bao giờ", note: "Thành ngữ an ủi khi hoàn thành việc trễ hạn" },
    { pattern: /\b(break a leg)\b/i, phrase: "break a leg", category: "idiom", tag: "Thành ngữ", vi: "Chúc may mắn nhé (trước buổi biểu diễn/thi)", note: "Lời chúc may mắn kinh điển trong tiếng Anh" },
    { pattern: /\b(on the same page)\b/i, phrase: "on the same page", category: "idiom", tag: "Thành ngữ", vi: "Cùng chung cách hiểu / Đồng quan điểm", note: "Đảm bảo mọi người đều hiểu thống nhất một vấn đề" },
    { pattern: /\b(under the weather)\b/i, phrase: "under the weather", category: "idiom", tag: "Thành ngữ", vi: "Hơi mệt trong người, cảm sốt nhẹ", note: "Diễn tả tình trạng sức khỏe không tốt một cách nhẹ nhàng" },
    { pattern: /\b(no offense|none taken)\b/i, phrase: "no offense", category: "collocation", tag: "Cụm từ", vi: "Không có ý xúc phạm đâu / Không sao đâu", note: "Phép lịch sự trước khi nói điều nhạy cảm" },
    { pattern: /\b(piece of cake)\b/i, phrase: "piece of cake", category: "idiom", tag: "Thành ngữ", vi: "Dễ như ăn kẹo / Dễ như trở bàn tay", note: "Miêu tả một việc vô cùng dễ dàng" },
    { pattern: /\b(pull yourself together)\b/i, phrase: "pull yourself together", category: "phrasal_verb", tag: "Động từ ghép", vi: "Hãy bình tĩnh lại, kiểm soát bản thân đi", note: "Khuyên ai đó đang hoảng loạn lấy lại bình tĩnh" },
    { pattern: /\b(wrap (your|my) head around)\b/i, phrase: "wrap head around", category: "idiom", tag: "Thành ngữ", vi: "Hiểu được / Tiêu hóa được điều phức tạp", note: "Nói về việc mất thời gian mới hiểu thấu một chuyện" },
    { pattern: /\b(long story short)\b/i, phrase: "long story short", category: "idiom", tag: "Thành ngữ", vi: "Tóm lại là, nói ngắn gọn là", note: "Dùng để rút gọn câu chuyện dài thành kết luận" },
    { pattern: /\b(at the end of the day)\b/i, phrase: "at the end of the day", category: "idiom", tag: "Thành ngữ", vi: "Suy cho cùng, rốt cuộc thì", note: "Đưa ra kết luận cốt lõi sau mọi tranh luận" },
    { pattern: /\b(figure (it|this|that|things) out)\b/i, phrase: "figure out", category: "phrasal_verb", tag: "Động từ ghép", vi: "Tìm ra giải pháp, hiểu ra vấn đề", note: "Động từ ghép cực kỳ thông dụng trong đời sống" },
    { pattern: /\b(make up (your|my|his|her) mind)\b/i, phrase: "make up one's mind", category: "idiom", tag: "Thành ngữ", vi: "Đưa ra quyết định dứt khoát", note: "Khuyên hoặc nói về việc chốt quyết định" },
    { pattern: /\b(never mind)\b/i, phrase: "never mind", category: "collocation", tag: "Cụm từ", vi: "Thôi bỏ đi, đừng bận tâm nữa", note: "Dùng khi không muốn người khác phải bận lòng" },
    { pattern: /\b(take your time)\b/i, phrase: "take your time", category: "collocation", tag: "Cụm từ", vi: "Cứ từ từ, không cần vội đâu", note: "Lịch sự cho người khác thời gian hoàn thành việc" },
    { pattern: /\b(I'm on it|I will be on it)\b/i, phrase: "I'm on it", category: "slang", tag: "Tiếng lóng", vi: "Tôi đang giải quyết ngay đây", note: "Nhận việc và báo rằng mình đang bắt tay vào làm" },
    { pattern: /\b(suit yourself)\b/i, phrase: "suit yourself", category: "idiom", tag: "Thành ngữ", vi: "Tùy ý bạn đấy, muốn sao cũng được", note: "Nói khi tôn trọng quyết định riêng của người khác" },
    { pattern: /\b(cross (your|my) fingers)\b/i, phrase: "cross fingers", category: "idiom", tag: "Thành ngữ", vi: "Cầu mong may mắn", note: "Hành động đan chéo ngón tay để cầu mong điều tốt đẹp" },
    { pattern: /\b(safe and sound)\b/i, phrase: "safe and sound", category: "idiom", tag: "Thành ngữ", vi: "Bình an vô sự, an toàn tuyệt đối", note: "Báo tin bình an sau chuyến đi hoặc tai nạn" },
    { pattern: /\b(speak of the devil)\b/i, phrase: "speak of the devil", category: "idiom", tag: "Thành ngữ", vi: "Vừa nhắc Tào Tháo là Tào Tháo tới", note: "Nói khi người vừa được nhắc tên bất ngờ xuất hiện" },
    { pattern: /\b(cost an arm and a leg)\b/i, phrase: "cost an arm and a leg", category: "idiom", tag: "Thành ngữ", vi: "Đắt cắt cổ, quá đắt đỏ", note: "Miêu tả thứ gì đó cực kỳ tốn kém" },
    { pattern: /\b(cut to the chase)\b/i, phrase: "cut to the chase", category: "idiom", tag: "Thành ngữ", vi: "Đi thẳng vào vấn đề chính đi", note: "Yêu cầu người nói không vòng vo" }
  ];

  // Reusable Spoken Sentence Formulas & Communicative Structures
  const SENTENCE_STRUCTURE_PATTERNS = [
    { pattern: /\bwhy don't (we|you)\b/i, name: "Why don't we + V?", template: "Why don't we/you + Verb(inf)?", vi: "Tại sao chúng ta không... / Hay là chúng ta...", note: "Mẫu câu đưa ra gợi ý, đề xuất cùng làm gì đó lịch sự" },
    { pattern: /\b(how about|what about)\b/i, name: "How about + V-ing / Noun?", template: "How about + V-ing / Noun?", vi: "Hay là... / Bạn nghĩ sao về việc...", note: "Hỏi ý kiến đối phương hoặc đưa ra giải pháp thay thế" },
    { pattern: /\bwould you mind\b/i, name: "Would you mind + V-ing?", template: "Would you mind + V-ing / if S + V?", vi: "Bạn có phiền lòng... / Xin bạn vui lòng...", note: "Lời nhờ vả hoặc xin phép trang trọng và lịch sự bậc nhất" },
    { pattern: /\b(could you please|would you please)\b/i, name: "Could you please + V?", template: "Could you please + Verb(inf)?", vi: "Xin vui lòng giúp tôi...", note: "Mở lời yêu cầu trang trọng và lịch sự" },
    { pattern: /\bit's (about )?time (to|that)\b/i, name: "It's time to + V", template: "It's time to + Verb(inf) / that S + V(past)", vi: "Đã đến lúc phải làm gì rồi", note: "Nhấn mạnh thời điểm cần hành động hoặc việc đã trễ" },
    { pattern: /\bno matter (what|how|where|who)\b/i, name: "No matter what/how + S + V", template: "No matter + wh-word + S + V", vi: "Dù có chuyện gì chăng nữa / Bất kể...", note: "Khẳng định sự quyết tâm hoặc điều kiện không thay đổi" },
    { pattern: /\b(there is|there's) no point in\b/i, name: "There's no point in + V-ing", template: "There's no point in + V-ing", vi: "Chẳng ích gì khi làm điều đó / Vô ích", note: "Khuyên ai đó đừng tốn thời gian hay công sức vô ích" },
    { pattern: /\b(I'd|I would) rather\b/i, name: "I'd rather + V (than V)", template: "S + would rather + Verb(inf) (+ than + Verb)", vi: "Tôi thà... còn hơn là...", note: "Biểu đạt sở thích hoặc lựa chọn cá nhân dứt khoát" },
    { pattern: /\b(as long as|so long as)\b/i, name: "As long as + S + V", template: "As long as + Clause", vi: "Miễn là / Chỉ cần...", note: "Đặt điều kiện tiên quyết để việc khác xảy ra" },
    { pattern: /\bhave you ever\b/i, name: "Have you ever + V3/ed?", template: "Have you ever + Past Participle?", vi: "Bạn đã từng... bao giờ chưa?", note: "Mẫu câu hỏi về trải nghiệm cuộc sống trong quá khứ" },
    { pattern: /\b(didn't|did not) mean to\b/i, name: "I didn't mean to + V", template: "S + didn't mean to + Verb(inf)", vi: "Tôi không cố ý / Không có ý định làm thế", note: "Dùng để xin lỗi hoặc giải thích nhằm tránh hiểu lầm" },
    { pattern: /\bas far as I (know|can tell|am concerned)\b/i, name: "As far as I know...", template: "As far as + Clause", vi: "Theo như tôi được biết, theo nhận định của tôi", note: "Mở đầu bày tỏ quan điểm, kiến thức cá nhân khiêm tốn" },
    { pattern: /\bfeel free to\b/i, name: "Feel free to + V", template: "Feel free to + Verb(inf)", vi: "Cứ tự nhiên / Đừng ngại làm gì", note: "Khuyến khích đối phương hành động thoải mái, không cần e dè" },
    { pattern: /\bcan't afford to\b/i, name: "Can't afford to + V", template: "S + cannot afford to + Verb(inf)", vi: "Không thể gánh nổi rủi ro / Không được phép...", note: "Nhấn mạnh hậu quả nghiêm trọng nếu phạm sai lầm" }
  ];

  /**
   * Helper to ensure NLP engine is available.
   */
  function getNlp() {
    if (nlpInstance) return nlpInstance;
    if (typeof nlp !== 'undefined') return nlp;
    if (typeof window !== 'undefined' && window.nlp) return window.nlp;
    if (typeof self !== 'undefined' && self.nlp) return self.nlp;
    if (typeof globalThis !== 'undefined' && globalThis.nlp) return globalThis.nlp;
    throw new Error('Compromise NLP library is not loaded. Please include lib/compromise.js');
  }

  /**
   * Helper to ensure CEFR dictionary is available.
   */
  function getCefrDict() {
    if (cefrDictInstance) return cefrDictInstance;
    if (typeof APP_CEFR_DICT !== 'undefined') return APP_CEFR_DICT;
    if (typeof window !== 'undefined' && window.APP_CEFR_DICT) return window.APP_CEFR_DICT;
    if (typeof self !== 'undefined' && self.APP_CEFR_DICT) return self.APP_CEFR_DICT;
    return null;
  }

  /**
   * Clean word string.
   */
  function cleanWord(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/^[^\w]+|[^\w]+$/g, '')
      .replace(/['’]s$/i, '')
      .trim();
  }

  /**
   * Smart normalization of text:
   * - Strips music notes (♪, ♫, #) & audio noise [brackets]
   * - Strips surrounding quote marks and trailing dangling commas
   * - Converts all-caps text (SDH / shouting captions) to natural Sentence case
   */
  function normalizeSentence(text) {
    if (!text) return '';
    let str = String(text).trim();
    str = str.replace(/[♪♫#]/g, '').trim();
    str = str.replace(/\[[^\]]+\]/g, ' ').replace(/\([^)]+\)/g, ' ').trim();
    str = str.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    str = str.replace(/[,;]+$/, '').trim();
    str = str.replace(/\s+/g, ' ');

    const letters = str.replace(/[^a-zA-Z]/g, '');
    const upper = str.replace(/[^A-Z]/g, '');
    if (letters.length >= 3 && (upper.length / letters.length) > 0.65) {
      str = str.toLowerCase();
      str = str.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
      str = str.replace(/\b(i)\b/g, 'I');
      str = str.replace(/\bi'([a-z]+)\b/g, (_, p1) => "I'" + p1);
    }
    return str;
  }

  function scoreContext(text) {
    if (!text) return -100;
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    let score = 0;

    if (wordCount >= 6 && wordCount <= 22) score += 60;
    else if (wordCount >= 4 && wordCount <= 28) score += 40;
    else if (wordCount < 3) score -= 60;
    else if (wordCount < 4) score -= 30;

    if (/[.!?]$/.test(text.trim())) score += 20;
    else if (/[,;:\-]$/.test(text.trim())) score -= 20;

    if (/\b(I|you|he|she|it|we|they|the|this|that|is|are|was|were|have|do|can|will|would)\b/i.test(text)) {
      score += 15;
    }
    return score;
  }

  /**
   * Extracts practical spoken phrases (phrasal verbs, idioms, collocations) from sentences.
   */
  function extractPhrases(sentences, options = {}) {
    if (!Array.isArray(sentences) || sentences.length === 0) return [];
    const videoTitle = options.videoTitle || '';
    const videoUrl = options.videoUrl || '';
    const results = [];
    const seen = new Map();

    sentences.forEach((sObj) => {
      const rawText = (sObj.text || '').trim();
      const clean = rawText
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]+\)/g, '')
        .replace(/^[-\s:;"]+/, '')
        .replace(/["\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;

      const words = clean.split(/\s+/);
      if (words.length < 3 || words.length > 25) return;

      let matched = null;
      for (const p of COMMUNICATIVE_PHRASE_PATTERNS) {
        if (p.pattern.test(clean)) {
          matched = p;
          break;
        }
      }
      if (!matched) return;

      const key = matched.phrase.toLowerCase();
      if (seen.has(key)) {
        const item = seen.get(key);
        item.frequency = (item.frequency || 1) + 1;
        return;
      }

      const item = {
        id: 'phrase_' + Math.random().toString(36).substr(2, 7),
        word: matched.phrase,
        lemma: matched.phrase,
        phrase: matched.phrase,
        sentence: clean,
        cleanSentence: clean,
        contextSentence: clean,
        highlightPhrase: matched.phrase,
        category: matched.category || 'collocation',
        phraseCategory: matched.category || 'collocation',
        tag: matched.tag || 'Cụm từ',
        vietnamese: matched.vi,
        translation: matched.vi,
        usageNote: matched.note,
        pos: 'phrase',
        posLabelVi: 'Cụm từ',
        cefr: 'Cụm từ',
        ipa: '',
        startTime: sObj.startTime || '00:00:00',
        startSec: sObj.startSec || 0,
        wordCount: words.length,
        frequency: 1,
        contexts: [{
          sentence: clean,
          text: clean,
          startTime: sObj.startTime,
          startSec: sObj.startSec,
          highlightWord: matched.phrase
        }],
        videoTitle: videoTitle,
        videoUrl: videoUrl,
        isPhrase: true,
        isCommunicative: true
      };

      seen.set(key, item);
      results.push(item);
    });

    return results;
  }

  /**
   * Extracts reusable sentence patterns and spoken formulas from sentences.
   */
  function extractSentenceStructures(sentences, options = {}) {
    if (!Array.isArray(sentences) || sentences.length === 0) return [];
    const videoTitle = options.videoTitle || '';
    const videoUrl = options.videoUrl || '';
    const results = [];
    const seen = new Map();

    sentences.forEach((sObj) => {
      const rawText = (sObj.text || '').trim();
      const clean = rawText
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]+\)/g, '')
        .replace(/^[-\s:;"]+/, '')
        .replace(/["\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;

      const words = clean.split(/\s+/);
      if (words.length < 3 || words.length > 25) return;

      let matched = null;
      for (const st of SENTENCE_STRUCTURE_PATTERNS) {
        if (st.pattern.test(clean)) {
          matched = st;
          break;
        }
      }
      if (!matched) return;

      const key = matched.name.toLowerCase();
      if (seen.has(key)) {
        const item = seen.get(key);
        item.frequency = (item.frequency || 1) + 1;
        return;
      }

      const item = {
        id: 'pat_' + Math.random().toString(36).substr(2, 7),
        word: matched.name,
        lemma: matched.name,
        pattern: matched.name,
        patternTemplate: matched.template,
        sentence: clean,
        cleanSentence: clean,
        contextSentence: clean,
        exampleSentence: clean,
        highlightPhrase: matched.name,
        tag: 'Cấu trúc câu',
        vietnamese: matched.vi,
        translation: matched.vi,
        usageNote: matched.note,
        pos: 'pattern',
        posLabelVi: 'Cấu trúc câu',
        cefr: 'Cấu trúc',
        ipa: '',
        startTime: sObj.startTime || '00:00:00',
        startSec: sObj.startSec || 0,
        wordCount: words.length,
        frequency: 1,
        contexts: [{
          sentence: clean,
          text: clean,
          startTime: sObj.startTime,
          startSec: sObj.startSec,
          highlightWord: matched.name
        }],
        videoTitle: videoTitle,
        videoUrl: videoUrl,
        isPattern: true,
        isCommunicative: true
      };

      seen.set(key, item);
      results.push(item);
    });

    return results;
  }

  /**
   * Backward-compatible extractor returning both phrases and sentence structures.
   */
  function extractCommunicativeSentences(sentences, options = {}) {
    const phrases = extractPhrases(sentences, options);
    const patterns = extractSentenceStructures(sentences, options);
    return [...phrases, ...patterns];
  }

  /**
   * Main analyzer: Analyzes subtitle cues and groups vocabulary by POS.
   * @param {Array<Object>} cues - Subtitle cues: [{ startSec, endSec, start, end, text, cleanText }]
   * @param {Object} [options] - Options: videoTitle, videoUrl, minFrequency, etc.
   */
  function analyzeSubtitles(cues, options = {}) {
    if (!Array.isArray(cues) || cues.length === 0) {
      return {
        summary: {
          totalWords: 0,
          uniqueWords: 0,
          nounCount: 0,
          verbCount: 0,
          adjCount: 0,
          advCount: 0,
          totalCues: 0
        },
        posGroups: {
          nouns: [],
          verbs: [],
          adjectives: [],
          adverbs: []
        },
        nouns: [],
        verbs: [],
        adjectives: [],
        adverbs: [],
        allWords: []
      };
    }

    const nlp = getNlp();
    const cefr = getCefrDict();
    const videoTitle = options.videoTitle || 'Movie / Video';
    const videoUrl = options.videoUrl || '';

    // Step 1: Preprocess cues into sentences with accurate timestamps
    // Subtitles are often broken across lines; we combine cues into sentences
    const sentences = [];
    let currentSentence = '';
    let currentStartSec = 0;
    let currentStartTime = '';

    cues.forEach((cue) => {
      let text = (cue.cleanText || cue.text || '').trim();
      if (!text) return;
      text = text.replace(/<[^>]+>/g, ' ').replace(/\[[^\]]+\]/g, ' ').replace(/\([^)]+\)/g, ' ').trim();
      if (!text) return;

      if (!currentSentence) {
        currentStartSec = cue.startSec || 0;
        currentStartTime = cue.start || '00:00:00';
      }

      currentSentence += (currentSentence ? ' ' : '') + text;

      // When sentence ends with . ? ! or length exceeds limit
      if (/[.!?]$/.test(text) || currentSentence.length > 200) {
        const norm = normalizeSentence(currentSentence);
        if (norm && norm.length >= 2) {
          sentences.push({
            text: norm,
            startSec: currentStartSec,
            startTime: currentStartTime
          });
        }
        currentSentence = '';
      }
    });

    if (currentSentence) {
      const norm = normalizeSentence(currentSentence);
      if (norm && norm.length >= 2) {
        sentences.push({
          text: norm,
          startSec: currentStartSec,
          startTime: currentStartTime
        });
      }
    }

    if (sentences.length === 0) {
      cues.forEach((cue) => {
        const norm = normalizeSentence(cue.cleanText || cue.text || '');
        if (norm) {
          sentences.push({
            text: norm,
            startSec: cue.startSec || 0,
            startTime: cue.start || '00:00:00'
          });
        }
      });
    }

    // Step 2: Extract & Tag Words with Compromise NLP
    // Maps: lemma -> WordRecord
    const wordMap = new Map();
    let totalWordCount = 0;

    sentences.forEach((sentenceObj) => {
      const doc = nlp(sentenceObj.text);
      doc.compute('root');

      // Process all terms in this sentence
      const jsonDocs = doc.json();
      if (!Array.isArray(jsonDocs)) return;

      jsonDocs.forEach((docItem) => {
        if (!docItem.terms || !Array.isArray(docItem.terms)) return;

        const terms = docItem.terms;

        terms.forEach((term, termIdx) => {
          const rawText = term.text || '';
          const cleaned = cleanWord(rawText);
          if (!cleaned || cleaned.length <= 1) return;
          if (STOPWORDS.has(cleaned)) return;

          // Lemmatization: base form
          let root = (term.root || term.normal || cleaned).toLowerCase().trim();
          root = cleanWord(root);
          if (!root || root.length <= 1) root = cleaned;

          const tags = new Set(term.tags || []);

          // Dictionary lookup
          const dictInfo = cefr ? (cefr.lookup(root) || cefr.lookup(cleaned)) : null;

          // Pronouns and determiners must NEVER be classified as nouns or verbs
          if (PRONOUN_DETERMINER_BLACKLIST.has(cleaned) || PRONOUN_DETERMINER_BLACKLIST.has(root)) {
            return;
          }
          if (AUXILIARY_VERBS.has(cleaned) || AUXILIARY_VERBS.has(root)) {
            return;
          }

          // If word ends in -ly (and is not an adjective like friendly/lovely), it is an ADVERB
          const isLyAdverb = cleaned.endsWith('ly') && !['friendly', 'lonely', 'lovely', 'silly', 'ugly', 'deadly', 'lively', 'curly', 'daily', 'weekly', 'monthly', 'early'].includes(cleaned);

          let primaryPos = null;

          if (isLyAdverb || KNOWN_ADVERBS.has(cleaned) || KNOWN_ADVERBS.has(root)) {
            primaryPos = 'adverb';
            root = cleaned; // Keep surface adverb form (e.g. 'there', 'tonight', 'quickly', 'warmly')
          }

          // POS Context Disambiguation: Inspect surrounding syntactic tokens
          if (!primaryPos) {
            const prevTerm = termIdx > 0 ? terms[termIdx - 1] : null;
            const nextTerm = termIdx < terms.length - 1 ? terms[termIdx + 1] : null;
            const prevPrevTerm = termIdx > 1 ? terms[termIdx - 2] : null;

            const prevClean = prevTerm ? cleanWord(prevTerm.normal || prevTerm.text) : '';
            const nextClean = nextTerm ? cleanWord(nextTerm.normal || nextTerm.text) : '';
            const prevPrevClean = prevPrevTerm ? cleanWord(prevPrevTerm.normal || prevPrevTerm.text) : '';
            const prevTags = new Set(prevTerm?.tags || []);
            const nextTags = new Set(nextTerm?.tags || []);

            const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'who', 'someone', 'somebody', 'everyone', 'everybody', 'nobody']);
            const MODAL_OR_INF = new Set(['to', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did', 'gonna', 'wanna', 'better', 'please']);
            const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'each', 'every', 'some', 'any', 'no', 'many', 'much', 'several', 'few', 'both']);

            const isPrecededBySubject = SUBJECT_PRONOUNS.has(prevClean) || (['not', "n't", 'never', 'always', 'also', 'really'].includes(prevClean) && SUBJECT_PRONOUNS.has(prevPrevClean));
            const isPrecededByModal = MODAL_OR_INF.has(prevClean) || (['not', "n't"].includes(prevClean) && MODAL_OR_INF.has(prevPrevClean));
            const isImperativeStart = termIdx === 0 && (tags.has('Imperative') || tags.has('Infinitive'));

            // Strong Verb context: Preceded by Subject Pronoun, Modal/Auxiliary/To, or Imperative command
            const hasStrongVerbContext = tags.has('Verb') && !tags.has('Copula') && (isPrecededBySubject || isPrecededByModal || isImperativeStart);

            // Strong Noun context: Preceded by Determiner/Article, Possessive, or Preceding Adjective
            const isPrecededByDet = DETERMINERS.has(prevClean) || (prevTags.has('Adjective') && DETERMINERS.has(prevPrevClean));
            const hasStrongNounContext = (tags.has('Noun') && !tags.has('Pronoun')) && (isPrecededByDet || prevTags.has('Adjective') || prevTags.has('Preposition'));

            // Strong Adjective context: Directly modifies a following noun, or preceded by copula
            const hasStrongAdjContext = tags.has('Adjective') && (nextTags.has('Noun') || (prevTags.has('Copula') && !nextTags.has('Noun')));

            if (hasStrongVerbContext && !hasStrongNounContext) {
              primaryPos = 'verb';
            } else if (hasStrongNounContext && !hasStrongVerbContext) {
              primaryPos = 'noun';
            } else if (hasStrongAdjContext && !hasStrongNounContext && !hasStrongVerbContext) {
              primaryPos = 'adjective';
            } else if (dictInfo && dictInfo.pos) {
              // Dictionary-authoritative fallback when syntactic context is neutral or balanced
              if (dictInfo.pos === 'adv') primaryPos = 'adverb';
              else if (dictInfo.pos === 'v') primaryPos = 'verb';
              else if (dictInfo.pos === 'adj') primaryPos = 'adjective';
              else if (dictInfo.pos === 'n') primaryPos = 'noun';
            }
          }

          // NLP heuristics fallback if still not classified
          if (!primaryPos) {
            if (tags.has('Pronoun') || tags.has('Determiner') || tags.has('Preposition') || tags.has('Conjunction')) {
              return;
            }

            if (tags.has('Adverb') || tags.has('Negative')) {
              primaryPos = 'adverb';
            } else if (cleaned.endsWith('ly') && !['friendly', 'lonely', 'lovely', 'silly', 'ugly', 'deadly', 'lively'].includes(cleaned)) {
              primaryPos = 'adverb';
            } else if (tags.has('Verb') && !tags.has('Auxiliary') && !tags.has('Copula')) {
              primaryPos = 'verb';
            } else if (tags.has('Adjective')) {
              primaryPos = 'adjective';
            } else if (tags.has('Noun')) {
              if (PRONOUN_DETERMINER_BLACKLIST.has(cleaned) || KNOWN_ADVERBS.has(cleaned)) return;
              primaryPos = 'noun';
            }
          }

          if (!primaryPos) return;

          // For adverbs ending in 'ly', keep the adverb form (e.g. 'quickly' instead of 'quick')
          if (primaryPos === 'adverb' && cleaned.endsWith('ly') && cleaned.length > 3) {
            root = cleaned;
          }
          if (!root || root.length <= 1) root = cleaned;

          totalWordCount++;

          // Build or update WordRecord
          let record = wordMap.get(root);
          if (!record) {
            // Dictionary & CEFR lookup
            const dictLookup = cefr ? cefr.lookup(root) : null;
            const cefrLevel = dictLookup ? dictLookup.cefr : (cefr ? cefr.getLevel(root) : 'B1');
            const ipa = dictLookup ? dictLookup.ipa : '';
            const viTranslation = dictLookup ? dictLookup.vi : '';

            record = {
              word: root,
              pos: primaryPos, // 'noun' | 'verb' | 'adjective' | 'adverb'
              posCounts: { noun: 0, verb: 0, adjective: 0, adverb: 0 },
              posContexts: { noun: [], verb: [], adjective: [], adverb: [] },
              frequency: 0,
              cefr: cefrLevel,
              ipa: ipa,
              translation: viTranslation,
              inflections: new Map(), // surface form -> count
              contexts: [], // array of example sentences with timestamps
              firstSeenSec: sentenceObj.startSec,
              videoTitle: videoTitle,
              videoUrl: videoUrl
            };
            wordMap.set(root, record);
          }

          record.frequency++;
          if (record.posCounts && record.posCounts[primaryPos] !== undefined) {
            record.posCounts[primaryPos]++;
          }

          // Track inflected forms (e.g. running: 3, ran: 1)
          const currInflectionCount = record.inflections.get(cleaned) || 0;
          record.inflections.set(cleaned, currInflectionCount + 1);

          const contextObj = {
            text: sentenceObj.text,
            sentence: sentenceObj.text,
            startSec: sentenceObj.startSec,
            startTime: sentenceObj.startTime,
            highlightWord: cleaned,
            videoTitle: videoTitle,
            videoUrl: videoUrl
          };

          // Save context example specific to this POS
          if (record.posContexts && record.posContexts[primaryPos] && record.posContexts[primaryPos].length < 3) {
            const alreadyInPos = record.posContexts[primaryPos].some(c => c.sentence === sentenceObj.text);
            if (!alreadyInPos) {
              record.posContexts[primaryPos].push(contextObj);
            }
          }

          // Add movie context example if not already full (store up to 5 best examples)
          if (record.contexts.length < 5) {
            const alreadyHasSentence = record.contexts.some(c => c.sentence === sentenceObj.text);
            if (!alreadyHasSentence) {
              record.contexts.push(contextObj);
            }
          }
        });
      });
    });

    // Step 3: Format word records into organized arrays
    const allWords = Array.from(wordMap.values()).map((record) => {
      // Determine dominant POS based on real usage counts in this subtitle track
      let dominantPos = record.pos;
      let highestCount = 0;
      const counts = record.posCounts || { [record.pos]: record.frequency || 1 };

      ['verb', 'noun', 'adjective', 'adverb'].forEach((p) => {
        const c = counts[p] || 0;
        if (c > highestCount) {
          highestCount = c;
          dominantPos = p;
        }
      });

      const totalPosOccurrences = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      const posDistribution = Object.entries(counts)
        .filter(([_, cnt]) => cnt > 0)
        .map(([posKey, cnt]) => ({
          pos: posKey,
          posLabelVi: getPosLabelVi(posKey),
          count: cnt,
          percent: Math.round((cnt / totalPosOccurrences) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      // Prioritize context sentence matching the dominant POS
      let prioritizedContexts = [];
      if (record.posContexts && record.posContexts[dominantPos] && record.posContexts[dominantPos].length > 0) {
        prioritizedContexts = [...record.posContexts[dominantPos]];
      }
      (record.contexts || []).forEach((c) => {
        if (!prioritizedContexts.some(pc => pc.sentence === c.sentence)) {
          prioritizedContexts.push(c);
        }
      });
      prioritizedContexts.sort((a, b) => scoreContext(b.text || b.sentence) - scoreContext(a.text || a.sentence));

      // Format inflections array
      const inflectionList = Array.from(record.inflections.entries()).map(([form, count]) => {
        return count > 1 ? `${form} (${count}x)` : form;
      });

      return {
        word: record.word,
        pos: dominantPos,
        posLabelVi: getPosLabelVi(dominantPos),
        posCounts: counts,
        posDistribution: posDistribution,
        posContexts: record.posContexts || {},
        hasMultiPos: posDistribution.length > 1,
        frequency: record.frequency,
        cefr: record.cefr,
        ipa: record.ipa,
        translation: record.translation,
        vietnamese: record.translation,
        inflections: inflectionList,
        contexts: prioritizedContexts,
        firstSeenSec: record.firstSeenSec,
        videoTitle: record.videoTitle,
        videoUrl: record.videoUrl
      };
    });

    // Sort by frequency descending by default
    allWords.sort((a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word));

    // Filter out words that already exist in Master List
    let finalWords = allWords;
    if (options.masterList) {
      const mlItems = (typeof options.masterList.getAll === 'function')
        ? options.masterList.getAll()
        : (Array.isArray(options.masterList) ? options.masterList : []);
      if (mlItems.length > 0) {
        const knownSet = new Set(mlItems.map((it) => (it.text || '').trim().toLowerCase()));
        finalWords = allWords.filter((w) => !knownSet.has(w.word.toLowerCase()));
      }
    }

    // Split into 4 POS groups
    const nouns = finalWords.filter(w => w.pos === 'noun');
    const verbs = finalWords.filter(w => w.pos === 'verb');
    const adjectives = finalWords.filter(w => w.pos === 'adjective');
    const adverbs = finalWords.filter(w => w.pos === 'adverb');

    // Extract practical conversational phrases and reusable sentence structures
    const phrases = extractPhrases(sentences, { videoTitle, videoUrl });
    const sentenceStructures = extractSentenceStructures(sentences, { videoTitle, videoUrl });
    const communicativeSentences = [...phrases, ...sentenceStructures];

    return {
      summary: {
        totalWords: totalWordCount,
        uniqueWords: finalWords.length,
        nounCount: nouns.length,
        verbCount: verbs.length,
        adjCount: adjectives.length,
        advCount: adverbs.length,
        phraseCount: phrases.length,
        patternCount: sentenceStructures.length,
        communicativeCount: communicativeSentences.length,
        totalCues: cues.length,
        videoTitle: videoTitle
      },
      posGroups: {
        nouns: nouns,
        verbs: verbs,
        adjectives: adjectives,
        adverbs: adverbs,
        phrase: phrases,
        pattern: sentenceStructures,
        sentences: communicativeSentences
      },
      categories: {
        noun: { count: nouns.length, words: nouns },
        verb: { count: verbs.length, words: verbs },
        adjective: { count: adjectives.length, words: adjectives },
        adverb: { count: adverbs.length, words: adverbs },
        phrase: { count: phrases.length, words: phrases },
        pattern: { count: sentenceStructures.length, words: sentenceStructures },
        sentences: { count: communicativeSentences.length, words: communicativeSentences }
      },
      totals: {
        totalWords: totalWordCount,
        uniqueWords: finalWords.length,
        nounCount: nouns.length,
        verbCount: verbs.length,
        adjCount: adjectives.length,
        advCount: adverbs.length,
        phraseCount: phrases.length,
        patternCount: sentenceStructures.length,
        communicativeCount: communicativeSentences.length
      },
      nouns: nouns,
      verbs: verbs,
      adjectives: adjectives,
      adverbs: adverbs,
      phrases: phrases,
      sentenceStructures: sentenceStructures,
      patterns: sentenceStructures,
      communicativeSentences: communicativeSentences,
      allWords: finalWords
    };
  }

  /**
   * Helper for Vietnamese POS labels.
   */
  function getPosLabelVi(pos) {
    switch (pos) {
      case 'noun': return 'Danh từ';
      case 'verb': return 'Động từ';
      case 'adjective': return 'Tính từ';
      case 'adverb': return 'Trạng từ';
      case 'phrase': return 'Cụm từ';
      case 'pattern': return 'Cấu trúc câu';
      case 'sentences': return 'Cụm từ & Cấu trúc';
      default: return 'Từ vựng';
    }
  }

  /**
   * Export vocabulary list to Anki format (.txt / .csv).
   * Fields: Word | POS | Phonetic | Vietnamese Translation | Context Sentence | Video Source
   */
  function exportToAnkiFormat(words) {
    if (!Array.isArray(words) || words.length === 0) return '';
    const lines = [];

    // Header comment for Anki import
    lines.push('#separator:Tab');
    lines.push('#html:true');
    lines.push('#tags:fx-english-extension subtitle-vocab');

    words.forEach((item) => {
      // Dedicated sentence card export
      if (item.isCommunicative || item.sentence) {
        const sentence = item.sentence || item.cleanSentence || '';
        const hl = item.highlightPhrase || '';
        const tag = item.tag || 'Giao tiếp';
        const trans = item.vietnamese || item.translation || '';
        const note = item.usageNote || '';
        const time = item.startTime ? `<small style="color:#f97316;">(${item.startTime})</small>` : '';

        let sentenceHtml = sentence;
        if (hl) {
          const escapedHl = String(hl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          sentenceHtml = sentence.replace(new RegExp(`\\b(${escapedHl})\\b`, 'gi'), '<b style="color:#6366f1;">$1</b>');
        }

        const frontCard = `<div style="font-size:20px;font-weight:bold;line-height:1.4;">${sentenceHtml}</div><div style="margin-top:8px;"><span style="font-size:12px;background:#6366f1;color:#fff;padding:2px 8px;border-radius:4px;">${tag}</span> ${time}</div>`;
        const backCard = `<div style="font-size:18px;font-weight:bold;color:#f97316;">${trans}</div><div style="font-size:13px;color:#cbd5e1;margin-top:8px;">Cụm từ cốt lõi: <b>${hl}</b></div><div style="font-size:12px;color:#94a3b8;margin-top:4px;font-style:italic;">${note}</div>`;

        const sanitizedFront = frontCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
        const sanitizedBack = backCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
        lines.push(`${sanitizedFront}\t${sanitizedBack}`);
        return;
      }

      const word = item.word || '';
      const pos = item.posLabelVi || item.pos || '';
      const ipa = item.ipa ? `[${item.ipa}]` : '';
      const trans = item.translation || '';

      const firstContext = (item.contexts && item.contexts[0]) ? item.contexts[0] : null;
      let sentenceHtml = '';
      if (firstContext) {
        const sentence = firstContext.sentence || '';
        const hl = firstContext.highlightWord || word;
        // Bold the target word in context sentence safely
        const escapedHl = String(hl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedHl})\\b`, 'gi');
        sentenceHtml = sentence.replace(regex, '<b>$1</b>');
        if (firstContext.startTime) {
          sentenceHtml += ` <small style="color:#f97316;">(${firstContext.startTime})</small>`;
        }
      }

      const backCard = `<div style="font-size:18px;font-weight:bold;color:#f97316;">${trans}</div><div style="font-size:13px;color:#888;">${pos} ${ipa}</div><div style="margin-top:8px;font-style:italic;">${sentenceHtml}</div>`;

      // Front: Word + IPA + POS badge
      const frontCard = `<div style="font-size:22px;font-weight:bold;">${word}</div><span style="font-size:12px;background:#333;color:#f8fafc;padding:2px 6px;border-radius:4px;">${pos}</span>`;

      // Sanitize tab and newline characters so Anki delimiter is not corrupted
      const sanitizedFront = frontCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
      const sanitizedBack = backCard.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');

      lines.push(`${sanitizedFront}\t${sanitizedBack}`);
    });

    return lines.join('\n');
  }

  /**
   * Export vocabulary list to CSV format compliant with Excel.
   */
  function exportToCsvFormat(words) {
    if (!Array.isArray(words) || words.length === 0) return '';
    const isSentences = Boolean(words[0] && (words[0].isCommunicative || words[0].sentence));

    if (isSentences) {
      const header = ['"Câu tiếng Anh"', '"Cụm từ then chốt"', '"Loại giao tiếp"', '"Nghĩa tiếng Việt"', '"Ứng dụng thực tế"', '"Mốc thời gian"', '"Nguồn phim/video"'];
      const lines = [header.join(',')];
      words.forEach((item) => {
        const row = [
          `"${(item.sentence || item.word || '').replace(/"/g, '""')}"`,
          `"${(item.highlightPhrase || '').replace(/"/g, '""')}"`,
          `"${(item.tag || '').replace(/"/g, '""')}"`,
          `"${(item.vietnamese || item.translation || '').replace(/"/g, '""')}"`,
          `"${(item.usageNote || '').replace(/"/g, '""')}"`,
          `"${(item.startTime || '').replace(/"/g, '""')}"`,
          `"${(item.videoTitle || '').replace(/"/g, '""')}"`
        ];
        lines.push(row.join(','));
      });
      return lines.join('\n');
    }

    const header = ['"Từ vựng"', '"Loại từ"', '"Phiên âm"', '"Cấp độ CEFR"', '"Tần suất"', '"Nghĩa tiếng Việt"', '"Câu ngữ cảnh phim"', '"Thời điểm (timestamp)"', '"Nguồn phim/video"'];
    const lines = [header.join(',')];

    words.forEach((w) => {
      const firstCtx = (w.contexts && w.contexts[0]) ? w.contexts[0] : { sentence: '', startTime: '' };
      const row = [
        `"${(w.word || '').replace(/"/g, '""')}"`,
        `"${(w.posLabelVi || w.pos || '').replace(/"/g, '""')}"`,
        `"${(w.ipa || '').replace(/"/g, '""')}"`,
        `"${(w.cefr || '').replace(/"/g, '""')}"`,
        w.frequency || 1,
        `"${(w.translation || '').replace(/"/g, '""')}"`,
        `"${(firstCtx.sentence || '').replace(/"/g, '""')}"`,
        `"${(firstCtx.startTime || '').replace(/"/g, '""')}"`,
        `"${(w.videoTitle || '').replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }

  return Object.freeze({
    analyzeSubtitles,
    getPosLabelVi,
    exportToAnkiFormat,
    exportToCsvFormat
  });
});
