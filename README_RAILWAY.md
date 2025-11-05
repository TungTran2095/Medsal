# Hướng dẫn Deploy lên Railway

Script này cập nhật realtime nến 1m BTC/USDT từng phút vào Supabase.

## Các file cần thiết

- `realtime_ohlcv_1m.py` - Script chính
- `requirements.txt` - Dependencies Python
- `railway.toml` - Config cho Railway
- `runtime.txt` - Python version (tùy chọn)

## Các bước deploy

### 1. Tạo project trên Railway

1. Truy cập [Railway](https://railway.app)
2. Đăng nhập/Đăng ký
3. Tạo project mới (New Project)
4. Chọn "Deploy from GitHub repo" hoặc "Empty Project"

### 2. Cấu hình biến môi trường

Trong Railway Dashboard, vào Settings → Variables, thêm các biến sau:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Lưu ý**: Nên dùng `SUPABASE_SERVICE_ROLE_KEY` để tránh lỗi RLS.

### 3. Deploy

**Cách 1: Deploy từ GitHub**
- Push code lên GitHub
- Kết nối repo với Railway
- Railway sẽ tự động detect và deploy

**Cách 2: Deploy từ CLI**
```bash
railway login
railway init
railway up
```

### 4. Kiểm tra

- Vào tab "Deployments" để xem logs
- Script sẽ tự động:
  1. Catch-up các nến bị thiếu khi khởi động
  2. Cập nhật realtime mỗi phút

## Cấu trúc file

```
.
├── realtime_ohlcv_1m.py  # Script chính
├── requirements.txt      # Dependencies
├── railway.toml          # Railway config
├── runtime.txt           # Python version
└── README_RAILWAY.md     # Hướng dẫn này
```

## Lưu ý

- Railway sẽ tự động restart service nếu crash (đã config trong `railway.toml`)
- Script sẽ tự động catch-up khi restart
- Đảm bảo Railway plan của bạn có đủ resources để chạy background worker liên tục
- Monitor logs trong Railway Dashboard để theo dõi hoạt động

## Troubleshooting

**Lỗi RLS Policy:**
- Đảm bảo đã set `SUPABASE_SERVICE_ROLE_KEY` trong environment variables

**Script không chạy:**
- Kiểm tra logs trong Railway Dashboard
- Đảm bảo đã set đầy đủ environment variables
- Kiểm tra Python version trong `runtime.txt`

**Rate limit từ Binance:**
- Script đã có retry logic với nhiều endpoint
- Nếu vẫn bị, có thể cần tăng delay giữa các request

