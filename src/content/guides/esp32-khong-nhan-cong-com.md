---
title: ESP32 không nhận cổng COM — cách khắc phục
description: Máy tính không thấy bo ESP32 khi cắm cáp. Nguyên nhân theo thứ tự phổ biến, từ cáp sạc tới thiếu driver và quyền truy cập trên Linux.
pubDate: 2026-09-08
tags: [esp32, driver, khắc phục lỗi]
---

Bo sáng đèn nhưng máy tính không thấy cổng nào. Đây là lỗi chặn nhiều người
nhất ở bước đầu tiên, và trong phần lớn trường hợp nguyên nhân không nằm ở bo.

Kiểm tra theo đúng thứ tự dưới đây — sắp xếp theo mức độ phổ biến, không phải
theo độ phức tạp.

## 1. Cáp USB (khoảng một nửa số trường hợp)

Rất nhiều cáp bán kèm sạc điện thoại chỉ có hai dây nguồn. Chúng sạc được
nhưng không truyền dữ liệu, nên bo có điện, đèn sáng, mà máy tính không thấy gì.

Đổi sang cáp khác — loại đi kèm ổ cứng di động hoặc cáp dữ liệu chính hãng.
Nếu đổi cáp là hết lỗi thì bạn đã xong.

## 2. Thiếu driver USB-UART

Bo ESP32 dùng một trong vài con chip cầu nối USB, và Windows không có sẵn
driver cho tất cả.

| Chip trên bo | Driver cần cài |
|---|---|
| CH340 / CH341 | Driver CH340 |
| CH9102 | Driver CH343 |
| CP2102 / CP2104 | Driver CP210x của Silicon Labs |
| USB gốc (ESP32-S3, C3) | Không cần driver |

Nhiều bo ESP32-S3 dùng USB gốc của chip, cắm là chạy ngay không cần driver.
Nếu bo của bạn có hai cổng USB-C, thường một cổng là USB gốc và một cổng đi qua
chip UART — thử cả hai.

Trên Windows, mở **Device Manager**. Nếu thấy thiết bị lạ có dấu chấm than
vàng, đó là do thiếu driver.

## 3. Quyền truy cập trên Linux

Linux nhận thiết bị nhưng không cho người dùng thường mở nó. Kiểm tra:

```bash
ls -l /dev/ttyUSB* /dev/ttyACM*
```

Nếu có thiết bị hiện ra nhưng thuộc nhóm `dialout`, thêm tài khoản của bạn vào
nhóm đó:

```bash
sudo usermod -aG dialout $USER
```

Sau đó **đăng xuất và đăng nhập lại**. Lệnh này không có tác dụng cho tới khi
phiên đăng nhập được tạo lại — đây là chỗ nhiều người tưởng đã làm đúng mà vẫn
lỗi.

### ModemManager chiếm cổng

Trên Ubuntu và các bản phái sinh, ModemManager đôi khi tưởng ESP32 là modem và
giữ cổng vài giây mỗi lần cắm, làm hỏng quá trình nạp.

```bash
sudo systemctl stop ModemManager
```

Nếu bạn không dùng modem 3G/4G, có thể tắt hẳn:

```bash
sudo systemctl disable ModemManager
```

## 4. Cổng USB và hub

Hub USB rẻ tiền thường không cấp đủ dòng cho ESP32 khi phát Wi-Fi. Cắm thẳng
vào máy tính, ưu tiên cổng phía sau đối với máy bàn.

## 5. Bo chưa vào chế độ nạp

Nếu cổng COM hiện ra nhưng quá trình nạp báo lỗi, hãy đưa bo vào chế độ boot
thủ công: giữ **BOOT**, nhấn thả **RESET**, rồi thả **BOOT**.

## Vẫn không được

Nếu đã qua cả năm bước mà máy tính vẫn không thấy bo, khả năng cao là bo bị
lỗi phần cứng. Nhắn cho chúng tôi kèm ảnh chụp bo và ảnh Device Manager, chúng
tôi sẽ xác nhận giúp.

Quay lại [hướng dẫn nạp firmware](/guides/nap-firmware-xiaozhi/) khi máy đã
nhận cổng.
