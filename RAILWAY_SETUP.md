# Railway Deployment Checklist

## ✅ Các file đã được tạo

1. **railway.toml** - Cấu hình Railway
   - Builder: NIXPACKS (tự động detect Python)
   - Start command: `python realtime_ohlcv_1m.py`
   - Auto restart khi crash

2. **runtime.txt** - Python version (3.11.0)

3. **requirements.txt** - Đã có sẵn, đầy đủ dependencies

4. **.railwayignore** - Loại trừ file không cần thiết khi deploy

5. **README_RAILWAY.md** - Hướng dẫn chi tiết

## 📋 Checklist trước khi deploy

### Environment Variables cần set trong Railway:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (khuyến nghị)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nếu không dùng service role)

### Files cần có trong repo:

- [x] `realtime_ohlcv_1m.py` - Script chính
- [x] `requirements.txt` - Dependencies
- [x] `railway.toml` - Railway config
- [x] `runtime.txt` - Python version (optional)

## 🚀 Quick Start

1. **Push code lên GitHub**
   ```bash
   git add .
   git commit -m "Add Railway deployment config"
   git push
   ```

2. **Tạo project trên Railway**
   - Vào https://railway.app
   - New Project → Deploy from GitHub repo
   - Chọn repo của bạn

3. **Set Environment Variables**
   - Railway Dashboard → Variables
   - Thêm các biến cần thiết

4. **Deploy**
   - Railway sẽ tự động detect và deploy
   - Xem logs trong tab Deployments

## 🔍 Verify Deployment

1. Kiểm tra logs trong Railway Dashboard
2. Xem script có catch-up và chạy realtime không
3. Kiểm tra dữ liệu trong Supabase

## 💡 Tips

- Railway sẽ tự động restart nếu script crash
- Script sẽ tự động catch-up khi restart
- Monitor logs để theo dõi hoạt động
- Có thể scale up/down trong Railway Dashboard

