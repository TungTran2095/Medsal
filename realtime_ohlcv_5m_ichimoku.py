"""
Script cập nhật realtime nến 5m BTC/USDT và chỉ số Ichimoku vào Supabase.

Tính năng:
- Đọc dữ liệu từ bảng ohlcv_1m
- Resample sang nến 5m
- Tính toán các chỉ số Ichimoku (Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span)
- Phát hiện tín hiệu mua/bán
- Cập nhật vào bảng OHLCV_5m_ichi mỗi 5 phút
- Khi khởi động: Tự động catch-up các nến bị thiếu từ lần cập nhật cuối đến hiện tại

Sử dụng:
    python realtime_ohlcv_5m_ichimoku.py

Dừng bằng Ctrl+C.

Ví dụ: Nếu script dừng 1 giờ, khi chạy lại sẽ tự động cập nhật 12 nến 5m bị thiếu
trước khi chuyển sang chế độ realtime.
"""

import os
import math
import time
import datetime as dt
from typing import Dict, Any, Optional, List

import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv


# Cấu hình
BINANCE_SYMBOL = "BTCUSDT"
SRC_TABLE = "ohlcv_1m"  # Bảng nguồn dữ liệu 1m
DST_TABLE = "OHLCV_5m_ichi"  # Bảng đích để lưu nến 5m + Ichimoku
INTERVAL_MINUTES = 5  # Nến 5 phút

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


def _parse_open_time_to_dt_utc(open_time_value: Any) -> dt.datetime:
    """Parse thời gian từ Supabase về UTC datetime."""
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


def fetch_ohlcv_1m_since(sb: Client, since_utc: dt.datetime, batch: int = 1000) -> pd.DataFrame:
    """
    Lấy dữ liệu từ bảng ohlcv_1m kể từ thời điểm UTC chỉ định.
    """
    all_rows: List[Dict[str, Any]] = []
    offset = 0
    since_str = since_utc.strftime("%Y-%m-%d %H:%M:%S")
    
    while True:
        try:
            res = (
                sb.table(SRC_TABLE)
                .select("open_time, open, high, low, close, volume")
                .gte("open_time", since_str)
                .order("open_time", desc=False)
                .range(offset, offset + batch - 1)
                .execute()
            )
            rows = getattr(res, "data", None) or []
            if not rows:
                break
            all_rows.extend(rows)
            offset += len(rows)
        except Exception as e:
            print(f"[WARN] Lỗi khi fetch dữ liệu 1m: {e}")
            break

    if not all_rows:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

    df = pd.DataFrame(all_rows)
    df["timestamp"] = df["open_time"].apply(_parse_open_time_to_dt_utc)
    df = df.drop(columns=["open_time"]).sort_values("timestamp").set_index("timestamp")
    
    # Ép kiểu
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    
    df = df.dropna(subset=["open", "high", "low", "close", "volume"])
    return df


def resample_to_5m(df_1m: pd.DataFrame) -> pd.DataFrame:
    """Resample dữ liệu 1m sang 5m."""
    if df_1m.empty:
        return df_1m.copy()
    
    ohlc = df_1m[["open", "high", "low", "close", "volume"]].copy()
    df_5m = pd.DataFrame()
    df_5m["open"] = ohlc["open"].resample("5T").first()
    df_5m["high"] = ohlc["high"].resample("5T").max()
    df_5m["low"] = ohlc["low"].resample("5T").min()
    df_5m["close"] = ohlc["close"].resample("5T").last()
    df_5m["volume"] = ohlc["volume"].resample("5T").sum()
    df_5m = df_5m.dropna(subset=["open", "high", "low", "close"])
    return df_5m


def calculate_ichimoku(
    df: pd.DataFrame,
    tenkan_periods: int = 9,
    kijun_periods: int = 26,
    senkou_b_periods: int = 52,
    offset: int = 26,
) -> pd.DataFrame:
    """Tính toán các chỉ số Ichimoku."""
    df = df.copy()
    
    # Tenkan-sen (Conversion Line)
    tenkan_high = df["high"].rolling(window=tenkan_periods).max()
    tenkan_low = df["low"].rolling(window=tenkan_periods).min()
    df["tenkan_sen"] = (tenkan_high + tenkan_low) / 2

    # Kijun-sen (Base Line)
    kijun_high = df["high"].rolling(window=kijun_periods).max()
    kijun_low = df["low"].rolling(window=kijun_periods).min()
    df["kijun_sen"] = (kijun_high + kijun_low) / 2

    # Senkou Span A (Leading Span A)
    df["senkou_span_a"] = ((df["tenkan_sen"] + df["kijun_sen"]) / 2).shift(offset)

    # Senkou Span B (Leading Span B)
    senkou_b_high = df["high"].rolling(window=senkou_b_periods).max()
    senkou_b_low = df["low"].rolling(window=senkou_b_periods).min()
    df["senkou_span_b"] = ((senkou_b_high + senkou_b_low) / 2).shift(offset)

    # Chikou Span (Lagging Span)
    df["chikou_span"] = df["close"].shift(-offset)

    return df


def identify_signals(df: pd.DataFrame) -> pd.DataFrame:
    """Phát hiện tín hiệu mua/bán dựa trên Ichimoku."""
    df = df.copy()
    
    # Kumo (Cloud) boundaries
    df["kumo_upper"] = df[["senkou_span_a", "senkou_span_b"]].max(axis=1)
    df["kumo_lower"] = df[["senkou_span_a", "senkou_span_b"]].min(axis=1)

    # Tenkan/Kijun cross
    df["tenkan_above_kijun"] = df["tenkan_sen"] > df["kijun_sen"]
    df["tenkan_cross_up"] = (df["tenkan_above_kijun"]) & (~df["tenkan_above_kijun"].shift(1).fillna(False))
    df["tenkan_cross_down"] = (~df["tenkan_above_kijun"]) & (df["tenkan_above_kijun"].shift(1).fillna(False))

    # Buy signal: Tenkan cross up + price above cloud + Chikou above past high
    condition1_buy = df["tenkan_cross_up"]
    condition2_buy = df["close"] > df["kumo_upper"]
    df["high_26_ago"] = df["high"].shift(26)
    condition3_buy = df["chikou_span"] > df["high_26_ago"]
    df["buy_signal"] = condition1_buy & condition2_buy & condition3_buy

    # Sell signal: Tenkan cross down + price below cloud + Chikou below past low
    condition1_sell = df["tenkan_cross_down"]
    condition2_sell = df["close"] < df["kumo_lower"]
    df["low_26_ago"] = df["low"].shift(26)
    condition3_sell = df["chikou_span"] < df["low_26_ago"]
    df["sell_signal"] = condition1_sell & condition2_sell & condition3_sell

    # Cleanup temporary columns
    df = df.drop(columns=[
        "kumo_upper",
        "kumo_lower",
        "tenkan_above_kijun",
        "tenkan_cross_up",
        "tenkan_cross_down",
        "high_26_ago",
        "low_26_ago",
    ])

    return df


def _to_float_or_none(x: Any) -> Optional[float]:
    """Chuyển đổi giá trị sang float hoặc None."""
    if x is None:
        return None
    try:
        f = float(x)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except Exception:
        return None


def update_only_chikou_and_signals(
    sb: Client,
    df_5m_ichi: pd.DataFrame,
    start_from: Optional[dt.datetime] = None,
    batch_size: int = 300,
) -> None:
    """
    Chỉ cập nhật các trường phụ thuộc vào chikou cho các nến đã tồn tại:
    chikou_span, buy_signal, sell_signal. Nếu start_from được cung cấp,
    chỉ cập nhật các nến có open_time >= start_from.
    """
    if df_5m_ichi.empty:
        return

    df = df_5m_ichi.copy()
    if start_from is not None:
        df = df[df.index >= start_from]
        if df.empty:
            return

    # Chỉ cập nhật các bản ghi đã tồn tại để tránh vi phạm NOT NULL ở các cột OHLCV
    # Lấy danh sách open_time cần cập nhật (theo khoảng start_from -> max index)
    timestamps: List[dt.datetime] = list(df.index)
    if not timestamps:
        return
    min_ts = timestamps[0]
    max_ts = timestamps[-1]
    if start_from is not None and start_from > min_ts:
        min_ts = start_from

    # Duyệt theo batch: truy vấn các open_time đã tồn tại và chỉ upsert những bản ghi đó
    all_rows: List[Dict[str, Any]] = []
    for ts, row in df.iterrows():
        if ts < min_ts or ts > max_ts:
            continue
        all_rows.append(
            {
                "open_time": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "chikou_span": _to_float_or_none(row.get("chikou_span")),
                "buy_signal": bool(row.get("buy_signal")) if pd.notna(row.get("buy_signal")) else None,
                "sell_signal": bool(row.get("sell_signal")) if pd.notna(row.get("sell_signal")) else None,
            }
        )

    total = len(all_rows)
    for i in range(0, total, batch_size):
        chunk = all_rows[i : i + batch_size]
        if not chunk:
            continue
        open_times = [c["open_time"] for c in chunk]
        try:
            exist = (
                sb.table(DST_TABLE)
                .select("open_time")
                .in_("open_time", open_times)
                .execute()
            )
            existing = {r["open_time"] for r in (getattr(exist, "data", None) or [])}
            filtered_chunk = [c for c in chunk if c["open_time"] in existing]
        except Exception:
            # Nếu không thể kiểm tra, bỏ qua batch để tránh insert thiếu cột NOT NULL
            filtered_chunk = []

        if not filtered_chunk:
            continue

        _ = (
            sb.table(DST_TABLE)
            .upsert(filtered_chunk, on_conflict="open_time", ignore_duplicates=False)
            .execute()
        )


def upsert_5m_ichimoku(sb: Client, df_5m_ichi: pd.DataFrame, batch_size: int = 500) -> None:
    """Upsert dữ liệu nến 5m + Ichimoku vào Supabase."""
    if df_5m_ichi.empty:
        print("[INFO] Không có dữ liệu để upsert.")
        return

    df = df_5m_ichi.copy()
    df = df.sort_index()

    records: List[Dict[str, Any]] = []
    for ts, row in df.iterrows():
        open_time_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        rec = {
            "open_time": open_time_str,
            "open": _to_float_or_none(row.get("open")),
            "high": _to_float_or_none(row.get("high")),
            "low": _to_float_or_none(row.get("low")),
            "close": _to_float_or_none(row.get("close")),
            "volume": _to_float_or_none(row.get("volume")),
            "tenkan_sen": _to_float_or_none(row.get("tenkan_sen")),
            "kijun_sen": _to_float_or_none(row.get("kijun_sen")),
            "senkou_span_a": _to_float_or_none(row.get("senkou_span_a")),
            "senkou_span_b": _to_float_or_none(row.get("senkou_span_b")),
            "chikou_span": _to_float_or_none(row.get("chikou_span")),
            "buy_signal": bool(row.get("buy_signal")) if pd.notna(row.get("buy_signal")) else None,
            "sell_signal": bool(row.get("sell_signal")) if pd.notna(row.get("sell_signal")) else None,
        }
        records.append(rec)

    total = len(records)
    for i in range(0, total, batch_size):
        chunk = records[i : i + batch_size]
        try:
            _ = (
                sb.table(DST_TABLE)
                .upsert(chunk, on_conflict="open_time", ignore_duplicates=False)
                .execute()
            )
        except Exception as e:
            print(f"[ERROR] Lỗi khi upsert batch: {e}")

    if total > 0:
        print(f"[OK] Đã upsert {total} nến 5m + Ichimoku")


def _get_latest_dst_open_time(sb: Client) -> Optional[dt.datetime]:
    """Lấy thời gian của nến 5m mới nhất trong DB."""
    try:
        res = (
            sb.table(DST_TABLE)
            .select("open_time")
            .order("open_time", desc=True)
            .limit(1)
            .execute()
        )
        data = getattr(res, "data", None) or []
        if not data:
            return None
        return _parse_open_time_to_dt_utc(data[0]["open_time"]).replace(tzinfo=dt.timezone.utc)
    except Exception as e:
        print(f"[WARN] Không thể lấy nến mới nhất từ DB: {e}")
        return None


def round_to_5min(dt_val: dt.datetime) -> dt.datetime:
    """Làm tròn datetime về đầu phút 5 phút gần nhất (00, 05, 10, 15, ...)."""
    minute = (dt_val.minute // 5) * 5
    return dt_val.replace(minute=minute, second=0, microsecond=0)


def catch_up_missing_5m(sb: Client) -> int:
    """
    Cập nhật các nến 5m bị thiếu từ nến mới nhất trong DB đến hiện tại.
    Trả về tổng số nến đã cập nhật.
    """
    print("\n[CATCH-UP] Đang kiểm tra và cập nhật các nến 5m bị thiếu...")
    
    latest_dt = _get_latest_dst_open_time(sb)
    now = dt.datetime.now(dt.timezone.utc)
    
    if latest_dt is None:
        print("[CATCH-UP] Không có dữ liệu trong DB. Bỏ qua catch-up.")
        return 0
    
    # Tính thời gian bắt đầu (sau nến 5m mới nhất)
    start_dt = round_to_5min(latest_dt) + dt.timedelta(minutes=5)
    
    if start_dt >= now:
        print("[CATCH-UP] Không có nến nào bị thiếu. DB đã được cập nhật.")
        return 0
    
    # Tính số nến 5m bị thiếu (cần lookback để tính Ichimoku)
    lookback_5m = 120  # ~10 giờ lịch sử 5m để tính Ichimoku đầy đủ
    lookback_minutes = lookback_5m * 5
    since_utc = start_dt - dt.timedelta(minutes=lookback_minutes)
    
    # Tính số nến 5m cần cập nhật
    missing_5m = (round_to_5min(now) - start_dt).total_seconds() / 300
    print(f"[CATCH-UP] Phát hiện khoảng trống: ~{int(missing_5m)} nến 5m")
    
    # Lấy dữ liệu 1m từ since_utc
    print(f"[CATCH-UP] Đang tải dữ liệu 1m từ {since_utc.strftime('%Y-%m-%d %H:%M:%S')}...")
    df_1m = fetch_ohlcv_1m_since(sb, since_utc)
    
    if df_1m.empty:
        print("[CATCH-UP] Không có dữ liệu 1m để xử lý.")
        return 0
    
    print(f"[CATCH-UP] Đã tải {len(df_1m)} nến 1m")
    
    # Resample sang 5m
    df_5m = resample_to_5m(df_1m)
    print(f"[CATCH-UP] Sau resample có {len(df_5m)} nến 5m")
    
    # Tính Ichimoku
    df_5m_ichi = calculate_ichimoku(df_5m)
    df_5m_ichi = identify_signals(df_5m_ichi)

    # Upsert cửa sổ 26 nến trước để đảm bảo có dữ liệu cho chikou của các nến trước đó
    prev_window_start = start_dt - dt.timedelta(minutes=26 * 5)
    df_prev_window = df_5m_ichi[(df_5m_ichi.index >= prev_window_start) & (df_5m_ichi.index < start_dt)]
    if not df_prev_window.empty:
        upsert_5m_ichimoku(sb, df_prev_window)

    # Chỉ lấy các nến từ start_dt trở đi để tránh double tính
    df_5m_ichi = df_5m_ichi[df_5m_ichi.index >= start_dt]
    
    if df_5m_ichi.empty:
        print("[CATCH-UP] Không có nến mới để cập nhật.")
        return 0
    
    # Upsert
    upsert_5m_ichimoku(sb, df_5m_ichi)
    
    total_new = len(df_5m_ichi)
    print(f"[CATCH-UP] ✅ Hoàn tất! Đã cập nhật {total_new} nến 5m bị thiếu.")
    
    return total_new


def update_realtime_5m_ichimoku(sb: Client) -> bool:
    """
    Cập nhật nến 5m mới nhất một lần với Ichimoku.
    Trả về True nếu thành công, False nếu lỗi.
    """
    now = dt.datetime.now(dt.timezone.utc)
    
    # Tính thời gian cần lấy dữ liệu 1m (lookback để tính Ichimoku)
    lookback_5m = 120  # ~10 giờ lịch sử 5m
    lookback_minutes = lookback_5m * 5
    since_utc = now - dt.timedelta(minutes=lookback_minutes)
    
    # Lấy dữ liệu 1m
    df_1m = fetch_ohlcv_1m_since(sb, since_utc)
    
    if df_1m.empty:
        print("[WARN] Không lấy được dữ liệu 1m từ DB")
        return False
    
    # Resample sang 5m
    df_5m = resample_to_5m(df_1m)
    
    if df_5m.empty:
        print("[WARN] Không có dữ liệu 5m sau resample")
        return False
    
    # Tính Ichimoku
    df_5m_ichi = calculate_ichimoku(df_5m)
    df_5m_ichi = identify_signals(df_5m_ichi)
    
    # Chỉ lấy nến 5m mới nhất (đã đóng)
    latest_5m = round_to_5min(now - dt.timedelta(minutes=5))
    df_latest = df_5m_ichi[df_5m_ichi.index == latest_5m]
    
    if df_latest.empty:
        print(f"[WARN] Chưa có nến 5m mới (đang chờ nến {latest_5m.strftime('%Y-%m-%d %H:%M:%S')})")
        return False
    
    # Upsert prev window 26 nến trước để đảm bảo có dữ liệu cho chikou của các nến trước đó
    prev_window_start = latest_5m - dt.timedelta(minutes=26 * 5)
    df_prev_window = df_5m_ichi[(df_5m_ichi.index >= prev_window_start) & (df_5m_ichi.index < latest_5m)]
    if not df_prev_window.empty:
        upsert_5m_ichimoku(sb, df_prev_window)

    # Upsert nến mới nhất
    upsert_5m_ichimoku(sb, df_latest)
    
    open_time = latest_5m.strftime("%Y-%m-%d %H:%M:%S")
    close_price = df_latest.iloc[0]["close"]
    print(f"[OK] Đã cập nhật nến 5m: {open_time} | Close: {close_price}")

    # Không cần backfill riêng vì đã upsert đầy đủ prev window
    
    return True


def run_realtime_loop():
    """
    Chạy vòng lặp cập nhật realtime mỗi 5 phút.
    Dừng bằng Ctrl+C.
    """
    print("=" * 60)
    print("🚀 BẮT ĐẦU CẬP NHẬT REALTIME NẾN 5M + ICHIMOKU BTC/USDT")
    print("=" * 60)
    
    # Kết nối Supabase
    try:
        sb = get_supabase_client()
        print(f"[INFO] Đã kết nối Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"[ERROR] Không thể kết nối Supabase: {e}")
        return
    
    print(f"[INFO] Symbol: {BINANCE_SYMBOL} | Interval: 5m")
    print(f"[INFO] Bảng nguồn: {SRC_TABLE}")
    print(f"[INFO] Bảng đích: {DST_TABLE}")
    
    # Catch-up các nến bị thiếu trước khi bắt đầu realtime
    catch_up_missing_5m(sb)
    
    print("\n[INFO] Bắt đầu chế độ realtime - cập nhật mỗi 5 phút. Dừng bằng Ctrl+C\n")
    
    consecutive_errors = 0
    max_errors = 5
    
    try:
        while True:
            current_time = dt.datetime.now(dt.timezone.utc)
            current_5min = round_to_5min(current_time)
            next_5min = current_5min + dt.timedelta(minutes=5)
            
            # Tính thời gian chờ đến đầu phút 5 tiếp theo
            sleep_seconds = (next_5min - current_time).total_seconds()
            
            # Nếu đã qua đầu phút 5, chờ ít nhất 2 giây để đảm bảo nến đã đóng
            if sleep_seconds < 2:
                sleep_seconds = 2
            
            # Đợi đến đầu phút 5 tiếp theo
            if sleep_seconds > 300:
                sleep_seconds = 300  # Giới hạn tối đa 5 phút
            
            print(f"[WAIT] Đợi {sleep_seconds:.1f}s đến đầu phút 5 tiếp theo...")
            time.sleep(sleep_seconds)
            
            # Cập nhật nến
            success = update_realtime_5m_ichimoku(sb)
            
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

