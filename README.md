# ⚡ FX English — Subtitle Downloader & POS Vocabulary Studio

> **Chrome Extension Manifest V3** chuyên biệt dành cho người học tiếng Anh qua phim trên **Netflix** và **YouTube**. Tự động tải phụ đề tiếng Anh đầy đủ (`.SRT`, `.VTT`, `.TXT`), bóc tách từ vựng thành **4 loại từ cốt lõi: Danh từ, Động từ, Tính từ, Trạng từ**, tra cứu offline chuẩn CEFR A1–C2, luyện tập qua **3D Flashcards** và xuất thẻ sang **Anki / CSV**.

---

## 🌟 Tính Năng Nổi Bật (Key Features)

| Tính năng | Chi tiết |
| :--- | :--- |
| ⬇ **Tải phụ đề đa định dạng** | Tải toàn bộ phụ đề tiếng Anh của tập phim/video dưới dạng `.SRT` (chuẩn xem offline), `.VTT` (chuẩn web), và `.TXT` (transcript dạng đoạn văn sạch, dễ đọc). |
| ⚡ **Phân tách 4 loại từ (POS)** | Phân loại từ vựng thành 4 nhóm ngữ pháp chính xác: <br>• 📘 **Danh từ (Nouns)** (loại trừ đại từ `this`, `that`, `it`...) <br>• 📙 **Động từ (Verbs)** (lọc trợ động từ `is`, `was`, `have`...) <br>• 📗 **Tính từ (Adjectives)** <br>• 📕 **Trạng từ (Adverbs)** (nhận diện chuẩn `there`, `here`, `suddenly`, `warmly`...) |
| 📂 **Lịch sử phim & video đã quét** | Tự động lưu trữ danh sách các phim Netflix, YouTube và file phụ đề đã phân tích. **Nhấp vào bất kỳ phim nào để tải lại tức thì toàn bộ 4 loại từ** và thẻ Flashcard mà không cần quét lại từ đầu! |
| 📖 **Từ điển Offline CEFR & Nghĩa Việt** | Tích hợp sẵn 2,500+ từ vựng thông dụng kèm cấp độ CEFR (A1–C2), phiên âm quốc tế IPA và nghĩa tiếng Việt. Hoạt động **100% offline**, không cần API key. |
| 🎬 **Ngữ cảnh phim & Tua đến thời điểm** | Mỗi từ vựng đi kèm câu thoại thực tế trong phim cùng nút **▶ Tua đến thời điểm** (`01:23`) và nút **🔊 Phát âm chuẩn**. |
| 🎴 **3D Flashcards Studio** | Chế độ lật thẻ ghi nhớ 3D trực quan, hỗ trợ phím tắt bàn phím (`Space` để lật thẻ, `←` / `→` để chuyển từ). |
| 🗂️ **Xuất Anki & CSV một chạm** | Tạo file Anki Deck chuẩn HTML tab-separated (sẵn Cloze context, phiên âm, loại từ) và file `.CSV` tương thích Excel, Google Sheets. |
| 🔒 **Bảo mật & Nhẹ nhàng** | Không gửi dữ liệu người dùng ra ngoài, không cần tài khoản, hoàn toàn tuân thủ Manifest V3 của Google Chrome. |

---

## 🏗 Kiến Trúc Dự Án (Clean Architecture)

```
fx-english/
├── manifest.json              # Cấu hình Chrome Extension Manifest V3
├── package.json               # Scripts kiểm tra cú pháp và unit test tự động
├── .gitignore                 # Chặn các file bảo mật, cache, secrets
├── icons/                     # Bộ icon nhận diện thương hiệu (16, 32, 48, 128, 512px)
├── lib/                       # Tầng Core NLP & Từ Điển (Chạy offline, tương thích Browser & Node)
│   ├── compromise.js          # Thư viện NLP phân tích ngữ pháp, gán nhãn POS
│   ├── subtitleParser.js      # Parser đa định dạng (SRT, WebVTT, TTML/XML, YouTube TimedText)
│   ├── cefrDict.js            # Từ điển offline 2,500+ từ vựng, CEFR A1-C2, IPA, nghĩa tiếng Việt
│   └── vocabAnalyzer.js       # Phân tích, lọc từ loại, lemmatize, xuất Anki & CSV
├── background/
│   └── background.js          # Service Worker điều phối tin nhắn, tải file, lưu trữ
├── content/
│   ├── netflixInjected.js     # Script MAIN world hook vào Player API của Netflix
│   ├── netflixContent.js      # Headless content worker trích xuất phụ đề Netflix
│   ├── youtubeInjected.js     # Script MAIN world lấy danh sách caption tracks trên YouTube
│   └── youtubeContent.js      # Headless content worker trích xuất phụ đề YouTube
├── popup/
│   ├── popup.html             # Giao diện popup khi nhấp vào icon tiện ích trên Chrome toolbar
│   ├── popup.css              # Styling hiện đại cho popup
│   └── popup.js               # Logic kiểm tra trạng thái video, tải nhanh và mở Studio
├── studio/
│   ├── studio.html            # Không gian học tập toàn màn hình (FX Vocabulary Studio)
│   ├── studio.css             # Styling dashboard & hiệu ứng 3D Flashcard Flip
│   └── studio.js              # Quản lý lọc CEFR, tìm kiếm, phát âm và lật thẻ 3D
└── test/
    └── verify.js              # Bộ kiểm thử tự động toàn diện (Parser, NLP, Dict, Export)
```

---

## 🚀 Hướng Dẫn Cài Đặt (Installation)

1. **Tải mã nguồn về máy**:
   ```bash
   git clone https://github.com/17130239-coder/fx-english.git
   ```
   *(hoặc tải file ZIP và giải nén vào thư mục trên máy)*.

2. **Mở trình quản lý tiện ích trên Google Chrome**:
   - Truy cập vào thanh địa chỉ: `chrome://extensions/`
   - Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.

3. **Tải tiện ích vào Chrome**:
   - Nhấp vào nút **Load unpacked** (Tải tiện ích đã giải nén).
   - Chọn thư mục `fx-english`.
   - Tiện ích **FX English** sẽ xuất hiện trên thanh công cụ của bạn! ⚡

---

## 🎬 Hướng Dẫn Sử Dụng (User Guide)

### 1. Trên Netflix hoặc YouTube (Giao diện sạch 100%, không popup che video)
1. Mở bất kỳ bộ phim nào trên Netflix (ví dụ: `netflix.com/watch/...`) hoặc video trên YouTube.
2. Đảm bảo video đang bật phụ đề tiếng Anh (**CC**).
3. Nhấp vào biểu tượng tiện ích **FX English ⚡** trên thanh công cụ Chrome:
   - Tiện ích tự động nhận diện video và kênh phụ đề tiếng Anh.
   - **Tải phụ đề ngay**: Bấm chọn `.SRT`, `.VTT`, hoặc `.TXT` để tải file về máy.
   - **Tách từ vựng**: Bấm **⚡ Tách từ vựng (4 loại từ)** — hệ thống sẽ tự động chuyển sang trang **FX Vocabulary Studio** toàn màn hình với đầy đủ từ vựng đã được phân loại!

---

### 2. Không Gian Học Chuyên Sâu (FX Vocabulary Studio)
- Xem toàn bộ từ vựng được phân tách thành 4 nhóm ngữ pháp:
  - 📘 **Danh từ**: `scholar`, `astronomer`, `journey`, `secret`...
  - 📙 **Động từ**: `discover`, `whisper`, `realize`...
  - 📗 **Tính từ**: `fascinating`, `mysterious`, `courageous`...
  - 📕 **Trạng từ**: `softly`, `warmly`, `suddenly`...
- Tra cứu cấp độ CEFR A1–C2, phiên âm IPA, nghĩa tiếng Việt chuẩn xác.
- Luyện tập với **3D Flashcards** (phím `Space` để lật, `←` / `→` để chuyển thẻ).
- Xuất toàn bộ từ vựng sang **Anki** hoặc **CSV (Excel/Google Sheets)** chỉ với 1 click!

---

### 3. Không Gian Học FX Vocabulary Studio & Thẻ Ghi Nhớ 3D
- Truy cập trực tiếp bằng cách mở trang tiện ích hoặc nhấp chuột phải vào icon chọn **Options**.
- **Kéo thả file phụ đề** `.srt` / `.vtt` từ máy tính vào, hoặc dán bất kỳ đoạn văn bản/phụ đề tiếng Anh nào.
- Xem thống kê chi tiết: Tổng số từ, số lượng danh từ, động từ, tính từ, trạng từ.
- Lọc theo trình độ **CEFR (A1, A2, B1, B2, C1, C2)** hoặc sắp xếp theo tần suất xuất hiện trong phim.
- **Chế độ 3D Flashcards**:
  - Nhấp vào nút **🎴 Chế độ 3D Flashcards**.
  - Mặt trước: Từ vựng, phiên âm IPA, loại từ, câu ngữ cảnh gốc trong phim.
  - Nhấn phím `Space` (hoặc nhấp chuột) để lật thẻ xem nghĩa tiếng Việt và từ gốc.
  - Dùng phím mũi tên `←` / `→` để duyệt qua toàn bộ các thẻ từ.

---

### 4. Nhập Từ Vựng Vào Anki (Import to Anki)
1. Trong Studio hoặc Modal, bấm **🗂️ Xuất Anki**. Tiện ích sẽ tải xuống file `[Ten_Phim]_anki.txt`.
2. Mở ứng dụng **Anki** trên máy tính -> Chọn **File** -> **Import** (hoặc nhấn `Ctrl+I` / `Cmd+I`).
3. Chọn file `*_anki.txt` vừa tải.
4. Đảm bảo cấu hình trong bảng import:
   - **Type**: `Basic`
   - **Field separator**: `Tab`
   - **Allow HTML in fields**: Đã được bật tự động qua header `#html:true`.
5. Bấm **Import**. Toàn bộ từ vựng kèm ngữ cảnh phim và nghĩa tiếng Việt sẽ sẵn sàng để bạn ôn tập ngắt quãng (Spaced Repetition)!

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Dự án được trang bị bộ kiểm thử tự động độc lập, không phụ thuộc môi trường ngoài:

```bash
# Kiểm tra cú pháp tất cả 10 file mã nguồn
npm run check-syntax

# Chạy toàn bộ bộ kiểm thử tự động
npm test
```

Kết quả:
```
🚀 Running FX English Test Suite...

📦 1. Verifying manifest.json and icon assets...
   ✓ Manifest V3 and 5 icon assets verified.

📚 2. Loading core NLP & Domain modules...
   ✓ All 4 core libraries loaded successfully.

🎬 3. Testing Universal Subtitle Parser (SRT, VTT, TXT)...
   ✓ Subtitle parser passed: SRT, VTT, clean TXT conversions verified.

📖 4. Testing Offline CEFR Dictionary & Morphology...
   ✓ CEFR dictionary passed: IPA, Vietnamese definitions & morphology verified.

⚡ 5. Testing POS Categorizer (Danh, Động, Tính, Trạng)...
   - 📘 Danh từ (Nouns): 4 words
   - 📙 Động từ (Verbs): 3 words
   - 📗 Tính từ (Adjectives): 4 words
   - 📕 Trạng từ (Adverbs): 1 words
   ✓ POS Categorization passed with high accuracy.

🗂️ 6. Testing Anki & CSV Exporters...
   ✓ Anki and CSV export formatting verified.

====================================================
🎉 ALL UNIT & INTEGRATION TESTS PASSED (100% OK)
====================================================
```

---

## 🛡️ Cam Kết Bảo Mật (Security & Privacy)

- ❌ **Không chứa API Key**: Hoạt động 100% độc lập, không yêu cầu OpenAI, Gemini, hay bất kỳ API trả phí nào.
- ❌ **Không theo dõi (No Tracking)**: Không thu thập lịch sử xem phim, cookies, hoặc thông tin cá nhân.
- ❌ **Không gửi phụ đề lên server**: Mọi tác vụ phân tích ngôn ngữ tự nhiên (NLP) đều diễn ra trực tiếp ngay trên trình duyệt của bạn (Client-Side).

---

## 📜 Giấy Phép (License)

Phát hành dưới giấy phép [MIT License](LICENSE).
Tác giả: **Nguyen Van Thuong** (`17130239-coder`).
