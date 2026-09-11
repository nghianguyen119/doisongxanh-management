# Hướng dẫn sử dụng Zalo dành cho quản lý

Tài liệu này giải thích cách dùng Zalo trong hệ thống quản lý công việc của
**Đời Sống Xanh**: quản lý làm việc trên web, nhân viên chỉ dùng Zalo — không cần
cài app, không cần đăng nhập.

> Dành cho quản lý/điều phối. Phần cài đặt kỹ thuật (tạo app, webhook, token)
> nằm ở `docs/zalo-oa-setup.md`.

---

## 1. Tóm tắt trong 30 giây

| Ai | Dùng gì | Làm gì |
| -- | ------- | ------ |
| **Quản lý** | Trang web `quanly.doisongxanh.com` | Kết nối nhân viên, giao việc, theo dõi, xác nhận hoàn thành |
| **Nhân viên** | Zalo (trò chuyện với OA của công ty) | Nhận việc, báo bắt đầu, gửi ảnh hoàn thành, báo sự cố |
| **Khách hàng** | Zalo (trò chuyện với OA của công ty) | Để lại lời nhắn; bot tự động cảm ơn, quản lý xem và trả lời thủ công |

Mọi thông báo (giao việc, nhắc hạn, xác nhận, huỷ…) đều được bot Zalo gửi tự
động. Quản lý không phải nhắn tin thủ công cho từng người.

> OA phục vụ **cả nhân viên lẫn khách hàng**. Hệ thống chỉ coi một tài khoản Zalo
> là nhân viên khi tài khoản đó **đã được kết nối** (xem mục 3). Mọi tài khoản
> khác được xử lý như khách hàng — không bị báo "chưa kết nối".

---

## 2. Vòng đời một công việc

```
Quản lý giao việc
        │
        ▼
[Đã giao] ── NV bấm ✅ Nhận việc ──► [Đã nhận]
        │                                    │
        │                     NV bấm ▶️ Bắt đầu
        │                                    ▼
        │                              [Đang làm]
        │                          ┌─────────┴──────────┐
        │                 NV bấm ✔️ Đã xong      NV bấm ⚠️ Báo sự cố
        │                          ▼                    ▼
        │                      [Đã xong]           [Gặp sự cố]
        │                          │                    │
        │          Quản lý Xác nhận hoàn thành    (xử lý xong, NV làm tiếp)
        │                          ▼
        └────────────────────► [Đã xác nhận]
```

Ngoài ra quản lý có thể **Huỷ công việc** (→ *Đã huỷ*) hoặc **Bỏ giao** để đưa
việc về *Mới tạo*.

---

## 3. Kết nối tài khoản Zalo cho nhân viên

Nhân viên phải được kết nối thì mới nhận được việc. Vào **Nhân viên → mở nhân
viên**, chọn một trong hai cách:

### Cách 1 · Mã mời (khuyên dùng)

1. Bấm **Tạo mã mời** → hệ thống hiện mã gồm **4 chữ cái** (ví dụ `MKTP`).
2. Gửi mã này cho nhân viên qua bất kỳ kênh nào (điện thoại, tin nhắn…).
3. Nhân viên **quan tâm OA** rồi nhắn mã đó cho OA — nhắn kèm nội dung khác
   cũng được, hệ thống tự tìm mã trong tin nhắn.

Mã **hết hạn sau 7 ngày**. Tạo mã mới sẽ thu hồi mã cũ, nên mã đã lộ ra ngoài
cũng không dùng lại được. Nếu nhân viên báo mã sai/hết hạn, chỉ cần bấm
**Tạo mã mời** lần nữa rồi gửi lại.

> Đây là **cách duy nhất** để nhân viên tự kết nối. Chia sẻ số điện thoại **không**
> còn tự động kết nối tài khoản — nhân viên chưa kết nối mà nhắn cho OA sẽ được
> xem là khách hàng.

### Cách 2 · Nhập Zalo ID

Nếu biết Zalo user id của nhân viên, dán vào ô **Cách 2 · Nhập Zalo ID** rồi bấm
**Gắn**. Cách này tiện khi nhân viên không nhắn được mã mời.

### Sau khi kết nối

- Trạng thái đổi thành **Đang hoạt động**, trang nhân viên hiện Zalo ID/ID hiển
  thị.
- Mỗi nhân viên chỉ gắn với **một tài khoản Zalo**. Muốn đổi sang tài khoản
  khác: bấm **Hủy kết nối** rồi kết nối lại.
- Trạng thái nhân viên:
  - **Chờ kết nối** — chưa liên kết Zalo, chưa nhận được việc.
  - **Đang hoạt động** — đã liên kết, nhận được việc và nhắc hạn.
  - **Ngừng** — không nhận tin nữa (do quản lý đặt, hoặc nhân viên bỏ quan tâm
    OA). Nhân viên tự bấm "Theo dõi lại" **cũng không tự mở lại được** — quản
    lý phải đổi trạng thái trong trang nhân viên.

---

## 4. Giao việc

1. Vào **Công việc → Tạo công việc** (hoặc nút **+ Tạo công việc**).
2. Nhập **Tiêu đề**, **Mô tả**, chọn **Ưu tiên**, **Hạn hoàn thành** và
   **Giao cho**.
3. Bấm **Tạo công việc**.

Ngay sau khi giao, nhân viên nhận được một **thẻ công việc** trên Zalo gồm tiêu
đề, mô tả, mức ưu tiên, hạn và các nút hành động.

Lưu ý:

- Chỉ chọn được nhân viên **Chờ kết nối/Đang hoạt động**; người chưa kết nối
  Zalo sẽ không nhận được thông báo (trong danh sách hiện chú thích
  *“chưa kết nối Zalo”*).
- Giao lại việc cho người khác: mở công việc → chọn nhân viên → **Giao / Gửi
  lại Zalo** (thẻ cũ bị thay bằng thẻ mới).
- Muốn thu hồi việc về trạng thái nháp: **Bỏ giao (về Mới tạo)**.

---

## 5. Nhân viên thấy gì và bấm gì trên Zalo

| Nút | Khi bấm | Kết quả |
| --- | ------- | ------- |
| ✅ **Nhận việc** | Nhân viên xác nhận đã biết việc | Công việc → *Đã nhận* |
| ▶️ **Bắt đầu** | Nhân viên khởi công | Công việc → *Đang làm* |
| ✔️ **Đã xong** | Báo hoàn thành | Bot hỏi ảnh kết quả |
| ⚠️ **Báo sự cố** | Có vấn đề | Bot hỏi mô tả sự cố |
| ℹ️ **Chi tiết** | Xem lại thông tin | Bot gửi lại thẻ công việc |

**Quy trình báo hoàn thành:** bấm ✔️ **Đã xong** → gửi **1 ảnh** kết quả, hoặc
gõ `bỏ qua` nếu không có ảnh. Trong lúc chờ ảnh, nhân viên có thể gõ thêm ghi
chú; nội dung đó sẽ được lưu vào công việc.

**Quy trình báo sự cố:** bấm ⚠️ **Báo sự cố** → gõ mô tả (hoặc gửi ảnh trước,
mô tả sau). Công việc chuyển sang *Gặp sự cố* để quản lý xử lý.

**Nhắn tin/ảnh tự do:** nếu nhân viên chỉ có **một** công việc đang mở, mọi tin
nhắn/ảnh gửi cho OA được gắn vào công việc đó (quản lý xem ở mục *Diễn tiến*).
Nếu có nhiều việc, bot sẽ nhắc dùng nút trên thẻ công việc.

---

## 6. Theo dõi và cập nhật trên web

- **Công việc** — danh sách, lọc theo trạng thái/ưu tiên/nhân viên, tìm theo
  tiêu đề, sắp xếp, chọn nhiều dòng để **huỷ hàng loạt**.
- **Bảng tiến độ** (Kanban) — kéo thả thẻ giữa các cột để đổi trạng thái; kéo
  thẻ về *Mới tạo* để bỏ giao. Việc đã **Đã xác nhận/Đã huỷ** bị khoá, không
  kéo được nữa.
- **Chi tiết công việc** — *Diễn tiến* (mọi bước, ai làm, khi nào; mỗi thông
  báo Zalo ghi rõ **đã gửi** hay **gửi thất bại** kèm lý do), ảnh đính kèm, ô
  **Gửi lời nhắn cho nhân viên** (gửi thẳng qua Zalo), **Giao lại**,
  **Xác nhận hoàn thành**, **Huỷ công việc**, **Sửa nội dung**.
- **Tổng quan** — số việc đang mở/quá hạn/chờ xác nhận và hoạt động gần đây.
- **Zalo OA** — trạng thái OA, nhân viên đã kết nối, khung **Tin nhắn khách
  hàng** (tin từ người chưa kết nối; bot đã tự phản hồi, quản lý trả lời thủ
  công trong Zalo), và công cụ **Mô phỏng Zalo** khi chạy thử.

### Nhắc hạn tự động

Hệ thống tự gửi nhắc khi công việc **còn ≤ 2 giờ** hoặc **đã quá hạn**, mỗi
công việc tối đa **1 lần/12 giờ**. Điều kiện để nhắc được: nhân viên *Đang hoạt
động*, đã kết nối Zalo và còn trong cửa sổ tương tác (xem mục 7).

### Trạng thái công việc

| Trạng thái | Ý nghĩa |
| ---------- | ------- |
| Mới tạo | Nháp, chưa giao cho ai |
| Đã giao | Đã gửi thẻ cho nhân viên, chờ nhân viên bấm *Nhận việc* |
| Đã nhận | Nhân viên đã xác nhận, chưa bắt đầu |
| Đang làm | Nhân viên đang thực hiện |
| Gặp sự cố | Nhân viên báo vướng mắc, cần quản lý xử lý |
| Đã xong | Nhân viên báo hoàn thành, chờ quản lý xác nhận |
| Đã xác nhận | Quản lý đã duyệt — kết thúc |
| Đã huỷ | Quản lý huỷ — kết thúc |

---

## 7. Giới hạn của Zalo cần biết

Đây là quy định của Zalo, không phải lỗi hệ thống:

1. **Cửa sổ gửi tin 7 ngày** — OA chỉ gửi được tin cho nhân viên trong vòng
   **7 ngày** kể từ lần cuối nhân viên tương tác với OA (nhắn tin, bấm nút…).
   Quá 7 ngày, hệ thống không gửi được thẻ giao việc/nhắc hạn cho người đó.
2. **Miễn phí trong 48 giờ** — tin gửi trong 48 giờ kể từ tương tác cuối là
   miễn phí; ngoài 48 giờ (nhưng còn trong 7 ngày) sẽ tính phí theo quy định
   của Zalo.
3. **Không gửi được nếu nhân viên chặn OA** — lúc đó trạng thái nhân viên
   chuyển thành **Ngừng**.
4. **Nhắc nhân viên tương tác định kỳ** — nếu nhân viên lâu ngày không nhắn
   gì, hãy yêu cầu họ nhắn cho OA ít nhất mỗi tuần (ví dụ nhắn "ok") để giữ
   cửa sổ 7 ngày, tránh việc giao việc không tới nơi.
5. **Không gửi file/tệp từ web** — nhân viên gửi ảnh thì được; quản lý chỉ gửi
   được tin nhắn chữ.
6. **Tin ngoài cửa sổ 7 ngày** cần mẫu ZNS (tin doanh nghiệp) — hệ thống hiện
   **chưa hỗ trợ**, cần liên hệ kỹ thuật nếu muốn bổ sung.

---

## 8. Xử lý tình huống thường gặp

| Tình huống | Cách xử lý |
| ---------- | ---------- |
| Nhân viên nhắn mã mời nhưng báo "không đúng hoặc hết hạn" | Mã quá 7 ngày hoặc đã bị thay. Bấm **Tạo mã mời** và gửi mã mới. |
| Nhân viên không nhận được thẻ giao việc | Kiểm tra: đã kết nối chưa, trạng thái có phải *Ngừng* không, lần tương tác cuối có quá 7 ngày không. Sửa xong bấm **Giao / Gửi lại Zalo** để gửi lại. |
| Nhân viên bấm nút cũ và báo "công việc đã kết thúc" | Thẻ đó thuộc công việc đã *Đã xác nhận* hoặc *Đã huỷ*. Đây là hành vi đúng để tránh cập nhật nhầm. |
| Muốn đổi tài khoản Zalo cho nhân viên | Mở nhân viên → **Hủy kết nối** → kết nối lại bằng mã mời hoặc Zalo ID mới. |
| Khách hàng nhắn tin cho OA | Bot tự động cảm ơn và ghi lại. Xem ở **Zalo OA → Tin nhắn khách hàng** rồi trả lời thủ công trong ứng dụng Zalo OA. Tài khoản này **không** trở thành nhân viên nếu chưa có mã mời. |
| Nhân viên báo hoàn thành nhưng chưa thấy ảnh | Bot đang chờ ảnh; nhân viên gửi ảnh, hoặc gõ `bỏ qua` để hoàn tất không ảnh. |
| Nhân viên phản hồi mà không thấy gắn vào việc nào | Nhân viên có nhiều việc đang mở; yêu cầu họ bấm nút trên đúng thẻ công việc. |
| Nghi ngờ nhân viên đã nghỉ việc | Đặt trạng thái **Ngừng** để dừng nhận tin; hệ thống cảnh báo nếu còn việc đang mở — nhớ giao lại cho người khác trước. |

---

## 9. Quy tắc vận hành gợi ý

- Giao việc kèm **hạn rõ ràng** và **mô tả ngắn, dễ hiểu** — nhân viên đọc trên
  điện thoại.
- Xác nhận hoàn thành sớm trong ngày để nhân viên thấy phản hồi.
- Khi công việc *Gặp sự cố*, mở chi tiết và dùng ô **Gửi lời nhắn** để trao đổi
  ngay trên Zalo.
- Kiểm tra **Bảng tiến độ** mỗi sáng để biết việc nào đang tắc.
- Nhắc nhân viên mới nhắn OA sau khi kết nối, để cửa sổ 7 ngày được kích hoạt.

> Khi cần kiểm thử mà không muốn gửi tin thật: môi trường phát triển có công cụ
> **Mô phỏng Zalo** ở trang *Zalo OA*. Công cụ này **tự tắt trên production**.
