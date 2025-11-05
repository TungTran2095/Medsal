"""
Script cập nhật realtime nến 1m BTC/USDT từng phút vào Supabase.

Tính năng:
- Khi khởi động: Tự động catch-up các nến bị thiếu từ lần cập nhật cuối đến hiện tại
- Chạy liên tục: Cập nhật nến mới nhất mỗi phút

Sử dụng:
    python realtime_ohlcv_1m.py

Dừng bằng Ctrl+C.

Ví dụ: Nếu script dừng 1 tiếng, khi chạy lại sẽ tự động cập nhật 60 nến bị thiếu
trước khi chuyển sang chế độ realtime.
"""

import os
import time
import datetime as dt
from typing import Dict, Any, Optional, List

import requests
from supabase import create_client, Client
from dotenv import load_dotenv


# Cấu hình
BINANCE_API_BASES = [
    "https://api.binance.com",
    "https://data.binance.com",
    "https://data-api.binance.vision",
]
BINANCE_SYMBOL = "BTCUSDT"
INTERVAL = "1m"
TABLE_NAME = "ohlcv_1m"

# Nạp biến môi trường
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def to_millis(ts: dt.datetime) -> int:
    """Chuyển datetime thành milliseconds timestamp."""
    return int(ts.timestamp() * 1000)


def get_supabase_client() -> Client:
    """
    Tạo Supabase client, ưu tiên SERVICE_ROLE_KEY để bypass RLS.
    """
    if not SUPABASE_URL:
        raise RuntimeError("Thiếu SUPABASE_URL trong file .env")
    
    # Ưu tiên dùng SERVICE_ROLE_KEY để bypass RLS
    if SUPABASE_SERVICE_ROLE_KEY:
        print("[INFO] Đang sử dụng SERVICE_ROLE_KEY (bypass RLS)")
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    if not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "Thiếu SUPABASE_ANON_KEY. Nếu bảng có RLS, hãy thêm SUPABASE_SERVICE_ROLE_KEY vào .env"
        )
    
    print("[WARN] Đang sử dụng ANON_KEY. Nếu có lỗi RLS, hãy dùng SERVICE_ROLE_KEY")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def fetch_latest_kline(symbol: str, interval: str) -> Optional[Dict[str, Any]]:
    """
    Lấy nến mới nhất từ Binance API.
    Trả về dict chứa dữ liệu nến hoặc None nếu lỗi.
    """
    # Lấy nến mới nhất (limit=1)
    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": 1,
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    last_err: Optional[Exception] = None
    for base in BINANCE_API_BASES:
        url = f"{base}/api/v3/klines"
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=10)
            
            if resp.status_code in (451, 403):
                # Bị chặn theo khu vực -> thử endpoint khác
                last_err = requests.HTTPError(f"{resp.status_code} from {url}")
                continue
                
            if resp.status_code == 429:
                # Rate limit -> đợi 1 giây rồi thử lại
                time.sleep(1)
                resp = requests.get(url, params=params, headers=headers, timeout=10)
                
            resp.raise_for_status()
            data = resp.json()
            
            if not data or len(data) == 0:
                return None
            
            # Lấy nến đầu tiên (và duy nhất)
            k = data[0]
            (
                open_time,
                open_,
                high,
                low,
                close,
                volume,
                close_time,
            ) = (
                k[0],
                k[1],
                k[2],
                k[3],
                k[4],
                k[5],
                k[6],
            )

            # Chuyển open_time (ms) -> chuỗi 'YYYY-MM-DD HH:MM:SS' (UTC)
            open_dt = dt.datetime.fromtimestamp(int(open_time) / 1000, tz=dt.timezone.utc)
            open_time_str = open_dt.strftime("%Y-%m-%d %H:%M:%S")

            return {
                "open_time": open_time_str,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
                "close_time": int(close_time),
            }
            
        except requests.RequestException as e:
            last_err = e
            continue

    # Nếu tất cả endpoint đều thất bại
    if last_err:
        print(f"[ERROR] Lỗi khi fetch từ Binance: {last_err}")
    return None


def upsert_kline(sb: Client, kline_data: Dict[str, Any]) -> bool:
    """
    Upsert một nến vào Supabase.
    Trả về True nếu thành công, False nếu lỗi.
    """
    try:
        result = (
            sb.table(TABLE_NAME)
            .upsert([kline_data], on_conflict="open_time", ignore_duplicates=False)
            .execute()
        )
        return True
    except Exception as e:
        print(f"[ERROR] Lỗi khi upsert vào Supabase: {e}")
        return False


def fetch_klines(
    symbol: str,
    interval: str,
    start_time_ms: int,
    limit: int = 1000,
) -> Optional[List[List[Any]]]:
    """
    Lấy nhiều nến từ Binance API từ một thời điểm bắt đầu.
    Trả về list các nến hoặc None nếu lỗi.
    """
    params = {
        "symbol": symbol,
        "interval": interval,
        "startTime": start_time_ms,
        "limit": limit,
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    last_err: Optional[Exception] = None
    for base in BINANCE_API_BASES:
        url = f"{base}/api/v3/klines"
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=30)
            
            if resp.status_code in (451, 403):
                last_err = requests.HTTPError(f"{resp.status_code} from {url}")
                continue
                
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                sleep_s = float(retry_after) if retry_after else 1.0
                time.sleep(sleep_s)
                resp = requests.get(url, params=params, headers=headers, timeout=30)
                
            resp.raise_for_status()
            return resp.json()
            
        except requests.RequestException as e:
            last_err = e
            continue

    if last_err:
        print(f"[ERROR] Lỗi khi fetch klines từ Binance: {last_err}")
    return None


def transform_binance_klines(klines: List[List[Any]]) -> List[Dict[str, Any]]:
    """
    Chuyển đổi dữ liệu nến từ Binance API sang format cho Supabase.
    """
    rows: List[Dict[str, Any]] = []
    for k in klines:
        (
            open_time,
            open_,
            high,
            low,
            close,
            volume,
            close_time,
        ) = (
            k[0],
            k[1],
            k[2],
            k[3],
            k[4],
            k[5],
            k[6],
        )

        # Chuyển open_time (ms) -> chuỗi 'YYYY-MM-DD HH:MM:SS' (UTC)
        open_dt = dt.datetime.fromtimestamp(int(open_time) / 1000, tz=dt.timezone.utc)
        open_time_str = open_dt.strftime("%Y-%m-%d %H:%M:%S")

        rows.append(
            {
                "open_time": open_time_str,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
                "close_time": int(close_time),
            }
        )
    return rows


def upsert_rows(sb: Client, rows: List[Dict[str, Any]], batch_size: int = 500) -> None:
    """
    Upsert nhiều nến vào Supabase theo batch.
    """
    total = len(rows)
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        try:
            _ = (
                sb.table(TABLE_NAME)
                .upsert(chunk, on_conflict="open_time", ignore_duplicates=False)
                .execute()
            )
        except Exception as e:
            print(f"[ERROR] Lỗi khi upsert batch: {e}")


def _parse_open_time_str_to_dt_utc(open_time_value: Any) -> dt.datetime:
    """
    Parse thời gian từ Supabase (có thể là string hoặc datetime) về UTC datetime.
    """
    if isinstance(open_time_value, dt.datetime):
        d = open_time_value
    else:
        s = str(open_time_value)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            d = dt.datetime.fromisoformat(s)
        except ValueError:
            d = dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


def _get_latest_open_time_ms(sb: Client) -> Optional[int]:
    """
    Lấy thời gian (ms) của nến mới nhất trong DB.
    Trả về None nếu không có nến nào.
    """
    try:
        res = sb.table(TABLE_NAME).select("open_time").order("open_time", desc=True).limit(1).execute()
        data = getattr(res, "data", None) or []
        if not data:
            return None
        latest_str = data[0]["open_time"]
        latest_dt = _parse_open_time_str_to_dt_utc(latest_str)
        return to_millis(latest_dt)
    except Exception as e:
        print(f"[WARN] Không thể lấy nến mới nhất từ DB: {e}")
        return None


def catch_up_missing_klines(sb: Client) -> int:
    """
    Cập nhật các nến bị thiếu từ nến mới nhất trong DB đến hiện tại.
    Trả về tổng số nến đã cập nhật.
    """
    print("\n[CATCH-UP] Đang kiểm tra và cập nhật các nến bị thiếu...")
    
    latest_ms = _get_latest_open_time_ms(sb)
    now_ms = to_millis(dt.datetime.now(dt.timezone.utc))
    
    if latest_ms is None:
        print("[CATCH-UP] Không có dữ liệu trong DB. Bỏ qua catch-up.")
        return 0
    
    # Tính thời gian bắt đầu (sau nến mới nhất)
    start_ms = latest_ms + 60_000  # +1 phút
    
    if start_ms >= now_ms:
        print("[CATCH-UP] Không có nến nào bị thiếu. DB đã được cập nhật.")
        return 0
    
    # Tính số phút bị thiếu
    missing_minutes = (now_ms - start_ms) / 60_000
    print(f"[CATCH-UP] Phát hiện khoảng trống: ~{int(missing_minutes)} phút")
    
    total_new = 0
    cursor_ms = start_ms
    
    while cursor_ms < now_ms:
        try:
            kl = fetch_klines(BINANCE_SYMBOL, INTERVAL, cursor_ms, limit=1000)
            if not kl:
                break
            
            rows = transform_binance_klines(kl)
            if not rows:
                break
            
            upsert_rows(sb, rows)
            total_new += len(rows)
            
            # Cập nhật cursor đến sau nến cuối cùng
            cursor_ms = int(rows[-1]["close_time"]) + 1
            
            # In progress
            if total_new % 100 == 0:
                print(f"[CATCH-UP] Đã cập nhật {total_new} nến...")
            
            time.sleep(0.1)  # Tránh rate limit
            
        except Exception as e:
            print(f"[ERROR] Lỗi trong quá trình catch-up: {e}")
            break
    
    if total_new > 0:
        print(f"[CATCH-UP] ✅ Hoàn tất! Đã cập nhật {total_new} nến bị thiếu.")
    else:
        print("[CATCH-UP] Không có nến mới để cập nhật.")
    
    return total_new


def update_realtime_1m(sb: Client) -> bool:
    """
    Cập nhật nến 1m mới nhất một lần.
    Trả về True nếu thành công, False nếu lỗi.
    """
    kline_data = fetch_latest_kline(BINANCE_SYMBOL, INTERVAL)
    
    if not kline_data:
        print("[WARN] Không lấy được dữ liệu từ Binance")
        return False
    
    success = upsert_kline(sb, kline_data)
    
    if success:
        open_time = kline_data["open_time"]
        close_price = kline_data["close"]
        print(f"[OK] Đã cập nhật nến: {open_time} | Close: {close_price}")
    
    return success


def run_realtime_loop():
    """
    Chạy vòng lặp cập nhật realtime mỗi phút.
    Dừng bằng Ctrl+C.
    """
    print("=" * 60)
    print("🚀 BẮT ĐẦU CẬP NHẬT REALTIME NẾN 1M BTC/USDT")
    print("=" * 60)
    
    # Kết nối Supabase
    try:
        sb = get_supabase_client()
        print(f"[INFO] Đã kết nối Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"[ERROR] Không thể kết nối Supabase: {e}")
        return
    
    print(f"[INFO] Symbol: {BINANCE_SYMBOL} | Interval: {INTERVAL}")
    print(f"[INFO] Bảng: {TABLE_NAME}")
    
    # Catch-up các nến bị thiếu trước khi bắt đầu realtime
    catch_up_missing_klines(sb)
    
    print("\n[INFO] Bắt đầu chế độ realtime - cập nhật mỗi phút. Dừng bằng Ctrl+C\n")
    
    consecutive_errors = 0
    max_errors = 5
    
    try:
        while True:
            current_time = dt.datetime.now(dt.timezone.utc)
            current_minute = current_time.replace(second=0, microsecond=0)
            next_minute = current_minute + dt.timedelta(minutes=1)
            
            # Tính thời gian chờ đến đầu phút tiếp theo
            sleep_seconds = (next_minute - current_time).total_seconds()
            
            # Nếu đã qua đầu phút, chờ ít nhất 1 giây để đảm bảo nến đã đóng
            if sleep_seconds < 1:
                sleep_seconds = 1
            
            # Đợi đến đầu phút tiếp theo
            if sleep_seconds > 60:
                sleep_seconds = 60  # Giới hạn tối đa 60 giây
            
            print(f"[WAIT] Đợi {sleep_seconds:.1f}s đến đầu phút tiếp theo...")
            time.sleep(sleep_seconds)
            
            # Cập nhật nến
            success = update_realtime_1m(sb)
            
            if success:
                consecutive_errors = 0
            else:
                consecutive_errors += 1
                if consecutive_errors >= max_errors:
                    print(f"[ERROR] Đã có {max_errors} lỗi liên tiếp. Dừng script.")
                    break
            
            # Nghỉ ngắn trước lần cập nhật tiếp theo
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\n[INFO] Đã nhận tín hiệu dừng (Ctrl+C)")
    except Exception as e:
        print(f"\n[ERROR] Lỗi không mong đợi: {e}")
    finally:
        print("[INFO] Đã dừng cập nhật realtime.")


if __name__ == "__main__":
    run_realtime_loop()

