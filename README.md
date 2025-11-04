# Binance Data Fetcher

Script Python để lấy dữ liệu OHLCV từ Binance API theo timeframe và khoảng thời gian nhất định.

## Cài đặt

```bash
pip install -r requirements.txt
```

## Cách sử dụng

### Sử dụng trong code

```python
from binance_data_fetcher import BinanceDataFetcher
from datetime import datetime, timedelta

# Khởi tạo fetcher (không cần API key cho dữ liệu công khai)
fetcher = BinanceDataFetcher()

# Lấy dữ liệu BTC/USDT 1 giờ trong 30 ngày gần nhất
end_date = datetime.now()
start_date = end_date - timedelta(days=30)

df = fetcher.get_klines(
    symbol='BTCUSDT',
    interval='1h',
    start_date=start_date,
    end_date=end_date
)

print(df.head())

# Lưu vào CSV
fetcher.save_to_csv(df, 'BTCUSDT_1h.csv')
```

### Các timeframe hỗ trợ

- `1m` - 1 phút
- `3m` - 3 phút
- `5m` - 5 phút
- `15m` - 15 phút
- `30m` - 30 phút
- `1h` - 1 giờ
- `2h` - 2 giờ
- `4h` - 4 giờ
- `6h` - 6 giờ
- `8h` - 8 giờ
- `12h` - 12 giờ
- `1d` - 1 ngày
- `3d` - 3 ngày
- `1w` - 1 tuần
- `1M` - 1 tháng

### Ví dụ sử dụng

```python
# Lấy dữ liệu theo string date
df = fetcher.get_klines(
    symbol='ETHUSDT',
    interval='15m',
    start_date='2024-01-01',
    end_date='2024-01-31'
)

# Lấy dữ liệu gần nhất (100 nến)
df = fetcher.get_klines(
    symbol='BTCUSDT',
    interval='1h',
    limit=100
)
```

### Chạy script

```bash
python binance_data_fetcher.py
```

Script sẽ yêu cầu bạn nhập:
- Cặp giao dịch (ví dụ: BTCUSDT, ETHUSDT)
- Timeframe (ví dụ: 1h, 15m, 1d)
- Ngày bắt đầu (YYYY-MM-DD)
- Ngày kết thúc (YYYY-MM-DD)

Dữ liệu sẽ tự động được lưu vào file CSV.

## Dữ liệu trả về

DataFrame pandas với các cột:
- `timestamp` - Thời gian (index)
- `open` - Giá mở cửa
- `high` - Giá cao nhất
- `low` - Giá thấp nhất
- `close` - Giá đóng cửa
- `volume` - Khối lượng giao dịch (base asset)
- `quote_volume` - Khối lượng giao dịch (quote asset)
- `trades` - Số lượng giao dịch
- `taker_buy_base` - Khối lượng mua (base asset)
- `taker_buy_quote` - Khối lượng mua (quote asset)
- `close_time` - Thời gian đóng cửa

