# CHIẾN GIỚI — Game Design Document (prototype hiện tại)

## Phạm vi và trạng thái

Đây là GDD khảo sát hiện trạng của prototype trong repository, không phải mô tả một MMORPG đã hoàn thiện. Trò chơi hiện là game hành động 2D trên trình duyệt, một khu vực huấn luyện, chiến đấu tự động hoặc thủ công, tiến triển nhân vật cơ bản và đồng bộ tài khoản tùy chọn.

| Hạng mục | Trạng thái | Bằng chứng / giới hạn |
|---|---|---|
| Khảo sát cấu trúc và công nghệ | Hoàn thành | Vue 3, Pinia, Vite, Phaser 4; Node.js HTTP API; PostgreSQL; WebSocket `ws` |
| GDD hiện trạng | Hoàn thành | Tài liệu này |
| Gameplay tham chiếu bên ngoài | Chưa khảo sát | Chưa có tên game tham chiếu hoặc tài liệu gameplay trong repo |
| Danh mục asset | Cần kiểm thử | World/nhân vật/quái hiện được vẽ bằng hình placeholder Phaser; chưa thấy thư mục asset riêng |

## Vòng lặp gameplay hiện có

1. Điều khiển nhân vật trong khu huấn luyện bằng WASD, phím mũi tên, chạm hoặc nhấp mặt đất.
2. Chọn Slime, Sói non hoặc Goblin; bật Auto Battle để tự tìm/tiếp cận/đánh mục tiêu, hoặc đánh thường/dùng kỹ năng thủ công.
3. Quái phản công trong tầm; người chơi có thể dùng thuốc, gục và hồi sinh.
4. Quái bị hạ cấp EXP, vàng và vật phẩm ngẫu nhiên; quái hồi sinh sau một khoảng chờ.
5. Tăng cấp, đổi trang bị, quản lý túi đồ, hoàn thành hai nhiệm vụ mẫu và mua/bán vật phẩm.
6. Người dùng có thể tạo tài khoản để lưu/tải save; lò rèn có endpoint nâng cấp vũ khí phía server.

## Hệ thống và trạng thái chức năng

Trạng thái dùng trong bảng: **Hoàn thành (prototype)** = có luồng chức năng cục bộ; **Đang làm** = vertical slice một phần; **Chưa làm** = chưa có; **Cần kiểm thử** = có mã nhưng cần kiểm chứng thủ công/tích hợp ở môi trường phù hợp. “Hoàn thành” ở đây không có nghĩa đủ tiêu chuẩn production.

| Hệ thống | Trạng thái | Hiện trạng / công việc còn lại |
|---|---|---|
| Tài khoản | Đang làm | Đăng ký/đăng nhập/đăng xuất, scrypt, cookie HttpOnly, session PostgreSQL; cần hardening và kiểm tra vận hành |
| Nhân vật | Đang làm | Chỉ số cơ bản và save; tạo/chỉnh ngoại hình, giới tính, nghề chưa có |
| Bản đồ | Đang làm | Một world tuyến tính dựng bằng Phaser; tilemap, nhiều khu, cổng và dữ liệu map chưa có |
| Di chuyển | Hoàn thành (prototype) | Bàn phím, click-to-move, touch; chưa có collision/map navigation thực |
| Chiến đấu | Đang làm | Client offline có combat phong phú; server socket có di chuyển/combat authoritative cho training-ground; chưa lưu tiến trình combat |
| Quái vật | Đang làm | Một số quái cố định, phản công, hồi sinh; AI/data-driven spawn và Boss chưa có |
| Trang bị | Hoàn thành (prototype) | Vũ khí/giáp, trang bị/tháo, chỉ số; cân bằng và persistence an toàn còn thiếu |
| Nghề nghiệp | Chưa làm | — |
| Thiên phú | Chưa làm | — |
| Pet | Chưa làm | — |
| Túi đồ | Hoàn thành (prototype) | Vật phẩm, stack, dùng/bán/mua, trang bị; gameplay server-authoritative chưa có |
| Phó bản | Chưa làm | — |
| Nhiệm vụ | Hoàn thành (prototype) | Hai nhiệm vụ mẫu, tiến độ/nhận thưởng phía client; server chưa xác thực |
| Gia viên | Chưa làm | — |
| Bang hội | Chưa làm | — |
| PvP | Chưa làm | — |
| Kinh tế | Đang làm | Gold, cửa hàng và forge; giao dịch/chợ/ledger chưa có, save client có thể giả mạo gold/inventory |
| Sự kiện/Admin | Chưa làm | — |
| Multiplayer | Đang làm | WebSocket authenticated, snapshot 10 Hz, simulation mỗi socket trong RAM; chưa đồng bộ người chơi cùng zone |
| Bảo mật | Đang làm | Session, origin/rate/message validation và combat server-side có; endpoint whole-character save vẫn tin dữ liệu client |

## Quy tắc gameplay prototype

- Đòn thường có cooldown 850 ms; kỹ năng tốn 15 MP, gây gấp đôi sát thương cơ bản, cooldown 4 giây.
- Auto Battle chọn/tiếp cận quái gần; giới hạn vùng farm được áp dụng ở mô phỏng server.
- Quái phản công; nhân vật hồi sinh sau 3 giây với nửa HP. Quái hồi sinh sau 6 giây.
- EXP lên cấp theo ngưỡng `100 × level²`, tối đa cấp 30 trong server API/simulation hiện tại.
- Client offline có drop equipment, potion, material; simulation server hiện cấp EXP/vàng nhưng chưa cấp loot.
- Các giá trị cân bằng hiện là prototype, cần data/config tập trung trước khi mở rộng.

## Asset và nội dung

Hiện chưa thấy asset sprite/tilemap/audio chuyên dụng trong `src`; scene vẽ nhân vật, NPC, quái và môi trường bằng primitive Phaser. Giai đoạn nội dung cần chọn phong cách hình ảnh, lập danh sách sprite/animation, thiết kế tilemap Tiled nếu phù hợp, rồi thêm asset manager và preload pipeline.

## Tiêu chí nghiệm thu tổng thể

Một tính năng chỉ được chuyển sang **Hoàn thành** khi có luồng UI, logic đúng, persistence phù hợp, kiểm tra hợp lệ phía server cho tài sản/tiến trình có giá trị, xử lý lỗi/mất kết nối, và kiểm thử tương ứng. Các tính năng đang có ở client không được xem là an toàn trước client đã chỉnh sửa.
