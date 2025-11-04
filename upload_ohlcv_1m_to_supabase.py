import os
import time
import math
import json
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple

import requests
from supabase import create_client, Client
from dotenv import load_dotenv


# Danh sách endpoint công khai cho dữ liệu thị trường (dùng xoay vòng nếu bị chặn khu vực)
BINANCE_API_BASES = [
    "https://api.binance.com",             # chính
    "https://data.binance.com",            # mirror cho public market data
    "https://data-api.binance.vision",     # mirror khác cho public market data
]
BINANCE_SYMBOL = "BTCUSDT"
INTERVAL = "1m"
START_DATE = dt.datetime(2025, 1, 1, 0, 0, 0, tzinfo=dt.timezone.utc)


# Nạp biến môi trường từ file .env (nếu có)
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Tùy chọn: nếu bạn có SERVICE ROLE KEY, đặt env SUPABASE_SERVICE_ROLE_KEY để script tự tạo bảng
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def to_millis(ts: dt.datetime) -> int:
    return int(ts.timestamp() * 1000)


def fetch_klines(
    symbol: str,
    interval: str,
    start_time_ms: int,
    limit: int = 1000,
) -> List[List[Any]]:
    params = {
        "symbol": symbol,
        "interval": interval,
        "startTime": start_time_ms,
        "limit": limit,
    }
    headers = {
        "Accept": "application/json",
        # Một số CDN/edge yêu cầu UA hợp lệ để tránh chặn bot
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        " AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36",
    }

    last_err: Optional[Exception] = None
    for base in BINANCE_API_BASES:
        url = f"{base}/api/v3/klines"
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=30)
            # Xử lý các tình huống phổ biến
            if resp.status_code in (451, 403):
                # Bị chặn theo khu vực/luật -> thử endpoint mirror kế tiếp
                last_err = requests.HTTPError(f"{resp.status_code} from {url}")
                continue
            if resp.status_code == 429:
                # Rate limit – tạm nghỉ ngắn rồi thử lại chính endpoint hiện tại 1 lần
                retry_after = resp.headers.get("Retry-After")
                sleep_s = float(retry_after) if retry_after else 1.0
                time.sleep(sleep_s)
                resp = requests.get(url, params=params, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            last_err = e
            # Thử base tiếp theo
            continue

    # Nếu tất cả base đều thất bại, ném lỗi cuối cùng
    if last_err:
        raise last_err
    raise RuntimeError("Không thể gọi Binance API: không có base hợp lệ")


def transform_binance_klines(
    klines: List[List[Any]],
    _symbol: str,
) -> List[Dict[str, Any]]:
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
            quote_volume,
            num_trades,
            taker_buy_base,
            taker_buy_quote,
            _ignore,
        ) = (
            k[0],
            k[1],
            k[2],
            k[3],
            k[4],
            k[5],
            k[6],
            k[7],
            k[8],
            k[9],
            k[10],
            k[11],
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


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def create_table_if_possible() -> None:
    """
    Tạo bảng bằng SQL API nếu có SERVICE ROLE KEY. Nếu không có, chỉ in hướng dẫn.
    """
    ddl = (
        """
        create table if not exists public.ohlcv_1m (
          open_time timestamp without time zone not null,
          open numeric(38, 18) not null,
          high numeric(38, 18) not null,
          low numeric(38, 18) not null,
          close numeric(38, 18) not null,
          volume numeric(38, 18) not null,
          close_time bigint not null,
          constraint ohlcv_1m_pk primary key (open_time)
        );
        create index if not exists ohlcv_1m_time_idx on public.ohlcv_1m(open_time);
        """
        .strip()
    )

    if not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "[INFO] Không có SUPABASE_SERVICE_ROLE_KEY. Hãy tạo bảng thủ công với SQL sau trong Supabase SQL Editor:\n\n"
            + ddl
        )
        return

    sql_endpoint = f"{SUPABASE_URL}/sql/v1"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"q": ddl}
    resp = requests.post(sql_endpoint, headers=headers, data=json.dumps(payload), timeout=60)
    if resp.status_code >= 300:
        raise RuntimeError(f"Tạo bảng thất bại: {resp.status_code} {resp.text}")
    print("[OK] Đã đảm bảo bảng public.ohlcv_1m tồn tại.")


def upsert_rows(sb: Client, rows: List[Dict[str, Any]], table: str = "ohlcv_1m", batch_size: int = 500) -> None:
    total = len(rows)
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        # upsert theo unique (open_time)
        _ = (
            sb.table(table)
            .upsert(chunk, on_conflict="open_time", ignore_duplicates=False)
            .execute()
        )


def _parse_open_time_str_to_dt_utc(open_time_value: Any) -> dt.datetime:
    """Chấp nhận chuỗi ISO8601 hoặc 'YYYY-MM-DD HH:MM:SS', chuẩn hóa về UTC."""
    # Nếu Supabase trả về kiểu datetime
    if isinstance(open_time_value, dt.datetime):
        d = open_time_value
    else:
        s = str(open_time_value)
        # Chuẩn hóa 'Z' -> '+00:00'
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        # Thử ISO trước (cho cả dạng có 'T' và offset)
        try:
            d = dt.datetime.fromisoformat(s)
        except ValueError:
            # Fallback sang định dạng có dấu cách
            d = dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    # Gán UTC nếu thiếu tz, sau đó chuyển về UTC
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


def _get_latest_open_time_ms(sb: Client) -> Optional[int]:
    res = sb.table("ohlcv_1m").select("open_time").order("open_time", desc=True).limit(1).execute()
    data = getattr(res, "data", None) or []
    if not data:
        return None
    latest_str = data[0]["open_time"]
    latest_dt = _parse_open_time_str_to_dt_utc(latest_str)
    return to_millis(latest_dt)


def update_ohlcv_1m_once(sb: Optional[Client] = None) -> int:
    """
    Cập nhật một lần các nến 1m mới (từ sau open_time mới nhất trong DB đến hiện tại).
    Trả về số nến upsert.
    """
    if sb is None:
        sb = get_supabase_client()

    latest_ms = _get_latest_open_time_ms(sb)
    if latest_ms is None:
        start_ms = to_millis(START_DATE)
    else:
        start_ms = latest_ms + 60_000  # bước tiếp theo sau nến mới nhất

    now_ms = to_millis(dt.datetime.now(dt.timezone.utc))
    if start_ms >= now_ms:
        return 0

    total_new = 0
    cursor_ms = start_ms
    while cursor_ms < now_ms:
        kl = fetch_klines(BINANCE_SYMBOL, INTERVAL, cursor_ms, limit=1000)
        if not kl:
            break
        rows = transform_binance_klines(kl, BINANCE_SYMBOL)
        upsert_rows(sb, rows)
        total_new += len(rows)
        cursor_ms = int(rows[-1]["close_time"]) + 1
        time.sleep(0.1)
    return total_new


def start_minutely_update_loop() -> None:
    """
    Chạy vòng lặp cập nhật 1 phút/lần. Dừng bằng Ctrl+C.
    """
    print("[LOOP] Bắt đầu cập nhật mỗi phút cho ohlcv_1m...")
    sb = get_supabase_client()
    create_table_if_possible()
    try:
        while True:
            started = dt.datetime.now(dt.timezone.utc)
            added = update_ohlcv_1m_once(sb)
            ended = dt.datetime.now(dt.timezone.utc)
            print(f"[TICK] {ended.strftime('%Y-%m-%d %H:%M:%S')} UTC - upsert {added} nến mới")

            # Ngủ tới đầu phút kế tiếp
            now = dt.datetime.now(dt.timezone.utc)
            next_minute = (now + dt.timedelta(minutes=1)).replace(second=0, microsecond=0)
            sleep_seconds = max(1.0, (next_minute - now).total_seconds())
            time.sleep(sleep_seconds)
    except KeyboardInterrupt:
        print("[LOOP] Đã dừng vòng lặp cập nhật.")

def main() -> None:
    print("[START] Bắt đầu tải dữ liệu Binance 1m và đẩy lên Supabase...")
    create_table_if_possible()

    sb = get_supabase_client()

    start_ms = to_millis(START_DATE)
    now_ms = to_millis(dt.datetime.now(dt.timezone.utc))

    fetched = 0
    last_progress_print = time.time()

    while start_ms < now_ms:
        try:
            kl = fetch_klines(BINANCE_SYMBOL, INTERVAL, start_ms, limit=1000)
        except requests.HTTPError as e:
            # Nếu lỗi do giới hạn, chờ 2s rồi thử lại
            print(f"[WARN] Lỗi HTTP khi gọi Binance: {e}. Đợi 2s rồi thử lại...")
            time.sleep(2)
            continue

        if not kl:
            # Không còn dữ liệu
            break

        rows = transform_binance_klines(kl, BINANCE_SYMBOL)
        upsert_rows(sb, rows)

        fetched += len(rows)
        start_ms = int(rows[-1]["close_time"]) + 1  # bước tiếp theo sau k-line cuối cùng

        # Tốc độ nhẹ để tránh rate-limit
        time.sleep(0.15)

        if time.time() - last_progress_print > 5:
            start_str = rows[0]["open_time"]
            end_dt = dt.datetime.fromtimestamp(rows[-1]["close_time"] / 1000, tz=dt.timezone.utc)
            print(
                f"[PROGRESS] Đã upsert {fetched} nến. Batch: {start_str} -> {end_dt.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            last_progress_print = time.time()

    print(f"[DONE] Hoàn tất. Tổng số nến upsert: {fetched}")


if __name__ == "__main__":
    main()


