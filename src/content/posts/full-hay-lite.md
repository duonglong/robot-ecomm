---
title: FULL hay LITE — bo nào chạy được bản nào
description: Bản FULL cần PSRAM để đệm âm thanh, bản LITE thì không. Giải thích vì sao ESP32-C3 không bao giờ chạy được FULL, và khi nào điều đó không quan trọng.
pubDate: 2026-09-06
tags: [xiaozhi, psram, esp32-s3, esp32-c3]
---

Firmware Xiaozhi có hai bản, và câu hỏi "bo của tôi chạy được bản nào" được hỏi
lại gần như mỗi tuần. Câu trả lời ngắn nằm ở một con số duy nhất: PSRAM.

## Khác nhau ở đâu

**FULL** có chatbot, phát nhạc, radio, podcast, đọc tin và tự động hoá nhà
thông minh.

**LITE** có chatbot, tin tức và radio cơ bản. Không có nhạc theo yêu cầu,
không podcast dài.

## Vì sao lại có giới hạn đó

Không phải do nhà phát triển cắt bớt tính năng cho vui. Phát một luồng nhạc
nghĩa là tải dữ liệu nén về, giải mã, rồi giữ một vùng đệm đủ lớn để tiếng
không bị ngắt quãng khi mạng chập chờn.

Vùng đệm đó cần bộ nhớ. RAM tích hợp trong chip ESP32 chỉ có vài trăm KB, dùng
cho chính hệ điều hành và ngăn xếp mạng. Muốn đệm âm thanh phải có **PSRAM** —
bộ nhớ rời gắn thêm trên bo.

- Bo có **8 MB PSRAM** → chạy được FULL
- Bo **không có PSRAM** → chỉ chạy được LITE

Đó là toàn bộ câu chuyện.

## Bảng tra nhanh

| Dòng bo | PSRAM | Bản chạy được |
|---|---|---|
| ESP32-S3 N16R8 | 8 MB | FULL |
| ESP32-S3 mạch tím | 8 MB | FULL |
| ESP32-S3 Super Mini | tuỳ bản | FULL nếu là bản R8 |
| ESP32-C3 Mini / C3 Zero | không có | LITE |

Chỗ cần cẩn thận là dòng Super Mini. Ký hiệu **N16R8** nghĩa là 16 MB flash và
8 MB PSRAM. Bản **N8R2** chỉ có 2 MB PSRAM và sẽ chạy FULL rất chật vật hoặc
không chạy. Khi mua, hãy nhìn ký hiệu R chứ đừng chỉ nhìn tên "Super Mini".

## Khi nào LITE là lựa chọn đúng

Nếu bạn cần **nhiều thiết bị** thay vì một thiết bị mạnh, C3 hợp lý hơn hẳn.
Đặt vài điểm hỏi đáp trong nhà, làm quà tặng, hoặc thử Xiaozhi lần đầu với chi
phí thấp nhất — LITE làm tốt tất cả những việc đó.

Nếu bạn định đặt một chiếc loa trợ lý ở phòng khách và muốn nó phát nhạc, đừng
tiết kiệm ở khâu này. Mua bo có PSRAM.

## Nếu bạn không muốn tự chọn

Các [robot AI hoàn chỉnh](/) đã được cấu hình sẵn đúng bản firmware
cho phần cứng bên trong. Không phải tra bảng, không phải nạp gì cả.
