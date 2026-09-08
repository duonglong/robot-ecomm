---
title: Nạp firmware Xiaozhi cho ESP32-S3 bằng trình duyệt
description: Toàn bộ quy trình nạp firmware Xiaozhi qua trình duyệt, không cần cài phần mềm — kèm những chỗ hay sai ở lần đầu.
pubDate: 2026-09-08
tags: [xiaozhi, esp32-s3, nạp firmware]
---

Nạp firmware Xiaozhi không cần cài IDE hay công cụ dòng lệnh. Trình duyệt làm
được toàn bộ việc đó. Nhưng có ba chỗ khiến người mới mất cả buổi tối, và cả ba
đều nằm trước bước bấm "Nạp".

## Chuẩn bị

- **Trình duyệt Chrome, Edge hoặc Opera trên máy tính.** Firefox và Safari
  không hỗ trợ Web Serial nên nút nạp sẽ không hoạt động. Điện thoại cũng không
  dùng được.
- **Cáp USB truyền dữ liệu.** Đây là lỗi phổ biến nhất: rất nhiều cáp đi kèm
  củ sạc chỉ có hai dây nguồn, không có dây dữ liệu. Bo sẽ sáng đèn nhưng máy
  tính không thấy gì cả.
- **Bo ESP32-S3 hoặc ESP32-C3.** Xem [gian hàng](/products/) nếu bạn chưa có.

## Các bước

1. Cắm bo vào máy tính bằng cáp dữ liệu.
2. Mở trang nạp firmware trong Chrome hoặc Edge.
3. Chọn đúng profile cho bo của bạn (xem phần bên dưới — chỗ này hay sai).
4. Bấm **Nạp FW**. Trình duyệt hiện hộp thoại chọn cổng.
5. Chọn cổng tương ứng với bo, rồi chờ. Quá trình mất khoảng một đến hai phút.
6. Khi xong, bo tự khởi động lại và phát ra một điểm phát Wi-Fi để bạn cấu hình.

## Chọn đúng profile

Đây là chỗ sai nhiều nhất. Cùng một con chip ESP32-S3 nhưng mỗi bo lại dùng
màn hình khác nhau, và mỗi loại màn hình cần một profile riêng.

Chọn sai profile thì bo vẫn khởi động bình thường, nhưng màn hình sẽ lệch màu,
xoay ngược hoặc không lên hình. **Không hỏng phần cứng** — chỉ cần nạp lại đúng
profile là được.

Nếu bo của bạn không có màn hình, chọn profile không màn hình. Nếu có màn tròn
1.28 inch, chọn profile GC9A01.

## Bo không vào được chế độ nạp

Một số bo cần đưa vào chế độ boot thủ công:

1. Giữ nút **BOOT**.
2. Trong lúc vẫn giữ BOOT, nhấn và thả nút **RESET**.
3. Thả nút BOOT.

Bo giờ đang ở chế độ nạp. Thử lại bước nạp.

Nếu bo không có nút, giữ chân GPIO0 xuống GND trong lúc cắm cáp.

## Sau khi nạp xong

Bo phát ra một mạng Wi-Fi có tên bắt đầu bằng `Xiaozhi`. Kết nối vào đó bằng
điện thoại, trang cấu hình sẽ tự mở ra để bạn nhập Wi-Fi nhà mình.

Nếu trang không tự mở, vào trình duyệt và truy cập `192.168.4.1`.

Lưu ý: Xiaozhi chỉ kết nối được Wi-Fi **2.4 GHz**. ESP32 không hỗ trợ băng tần
5 GHz. Nếu router phát chung một tên cho cả hai băng tần, hãy tách tên ra hoặc
tạm tắt băng 5 GHz trong lúc cấu hình.

## Máy tính không thấy bo

Xem [khắc phục lỗi không nhận cổng COM](/guides/esp32-khong-nhan-cong-com/).
