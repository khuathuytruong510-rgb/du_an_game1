# CHIẾN GIỚI — Backlog và roadmap

## Trạng thái

`Hoàn thành` = đã có trong repo; `Đang làm` = có lát cắt một phần; `Chưa làm` = chưa triển khai; `Cần kiểm thử` = cần xác minh trên luồng/tích hợp được nêu. Tất cả kiểm thử dưới đây được ghi nhận từ cấu hình và test files hiện có; chưa khẳng định đã chạy trong lần khảo sát này.

## Ưu tiên tiếp theo

| Ưu tiên | Công việc | Trạng thái | Điều kiện hoàn tất |
|---|---|---|---|
| P0 | Chốt nguồn authority cho save và progression | Đang làm | Client không thể tự tăng gold, inventory, equipment, quest hoặc EXP; thao tác được kiểm tra và lưu nguyên tử phía server |
| P0 | Chốt khác biệt guest và account | Đang làm | Luồng gameplay nhất quán hoặc giới hạn guest rõ; chuyển account không ghi đè tiến trình server hợp lệ |
| P0 | Kiểm chứng vertical slice auth/API/realtime với PostgreSQL thật | Cần kiểm thử | Register/login, join zone, combat, reconnect, reload và persistence có kết quả kỳ vọng |
| P1 | Chia nội dung world thành data/config và thiết kế map đầu tiên | Chưa làm | Map, spawn, NPC, portal, giới hạn cấp và collision có schema rõ, được scene tiêu thụ |
| P1 | Đồng bộ player cùng zone và lifecycle session/gameplay | Chưa làm | Hai client thấy nhau, trạng thái có authority, disconnect/rejoin không tạo bản sao hoặc mất tiến trình |
| P1 | Thiết kế reward/inventory transaction | Chưa làm | Drop/quest/shop/forge chống nhận lặp, kiểm tra quyền sở hữu và có ledger cho tiền |
| P2 | Tạo asset pipeline và tách scene/system theo nhu cầu | Đang làm | Sprite/map/audio đã chọn, preload có lỗi/loading rõ, logic scene không chứa toàn bộ domain |
| P2 | Nội dung nhân vật, nhiệm vụ và progression | Đang làm | Tạo/lưu nhân vật; nhiệm vụ có trạng thái server-side; level/skill/equipment được persist |
| P3 | Dungeon, boss, pet, guild, social, PvP, admin | Chưa làm | Mỗi domain có thiết kế dữ liệu, quyền, UI, server logic và nghiệm thu riêng |
| P3 | Deploy, observability, backup/restore và tải | Chưa làm | Staging/prod lặp lại được, secrets an toàn, metrics/logs, khôi phục dữ liệu được diễn tập |

## Ma trận 18 nhóm hệ thống

| # | Hệ thống | Trạng thái | Bước kế tiếp |
|---:|---|---|---|
| 1 | Tài khoản | Đang làm | Kiểm tra session lifecycle, rate limits và deployment cookie/origin |
| 2 | Nhân vật | Đang làm | Tạo/chỉnh ngoại hình, nghề và lưu domain phía server |
| 3 | Bản đồ | Đang làm | Schema dữ liệu map, collision, NPC, portal, spawn |
| 4 | Di chuyển | Hoàn thành (prototype) | Collision, zone transition, server resync |
| 5 | Chiến đấu | Đang làm | Persist combat rewards, thống nhất guest/account và xử lý reconnect |
| 6 | Quái vật | Đang làm | Content config, spawn groups, AI/state lifecycle |
| 7 | Trang bị | Đang làm | Mọi thay đổi ownership/equip chỉ qua server transaction |
| 8 | Nghề nghiệp | Chưa làm | Chưa có |
| 9 | Thiên phú | Chưa làm | Chưa có |
| 10 | Pet | Chưa làm | Chưa có |
| 11 | Túi đồ | Đang làm | Dời add/use/sell/buy/drop sang API/domain server |
| 12 | Phó bản | Chưa làm | Chưa có |
| 13 | Nhiệm vụ | Đang làm | Hai quest mẫu phía client; chuyển điều kiện và reward lên server |
| 14 | Gia viên | Chưa làm | Chưa có |
| 15 | Bang hội | Chưa làm | Chưa có |
| 16 | PvP | Chưa làm | Chưa có |
| 17 | Kinh tế | Đang làm | Wallet ledger, giao dịch nguyên tử, chống lạm phát/nhân bản |
| 18 | Sự kiện/Admin | Chưa làm | Chưa có |

## Kiểm thử hiện có và việc cần xác minh

- Có scripts `npm test`, `npm run test:api`, `npm run test:game`, `npm run build`, `npm run build:api`.
- Có test files cho API, simulation, protocol, Auto Battle, rewards, player store và persistence settings/save.
- **Cần kiểm thử:** chạy build/test trên môi trường phát triển; kiểm thử tích hợp với PostgreSQL; kiểm tra trình duyệt/mobile, mất mạng/reconnect, hai client cùng zone và migration/backup.
- Test đơn vị hiện có không chứng minh multiplayer đồng bộ, chống sửa save hoặc khả năng chịu tải production.

## Lộ trình theo cổng nghiệm thu

1. **An toàn tiến trình:** đóng lỗ hổng character save; domain commands và transaction; quyết định guest/account.
2. **World slice:** map data-driven, collision, NPC/portal và server zone membership.
3. **Combat slice hoàn chỉnh:** state authoritative, loot/quest persistence, reconnect/resync và hai client cùng zone.
4. **Vertical progression:** character/equipment/inventory/quest qua server và UI hiện có.
5. **Mở rộng nội dung:** dungeon/boss/pet/social/economy/PvP theo nhu cầu thiết kế đã chốt.
6. **Phát hành:** staging, bảo mật, monitoring, load, backup/restore và quy trình vận hành.

Không gán lịch tuần cho các giai đoạn trước khi chốt scope, nhân lực, nội dung asset và tiêu chí demo.
