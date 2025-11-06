import os
import math
import time
import json
import datetime as dt
from typing import Any, Dict, List, Optional

import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv


# Nạp biến môi trường
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SRC_TABLE = "ohlcv_1m"
DST_TABLE = "OHLCV_5m_ichi"  # theo yêu cầu đặt tên bảng này


def get_supabase_client() -> Client:
    if not SUPABASE_URL:
        raise RuntimeError("Thiếu SUPABASE_URL trong biến môi trường")

    if SUPABASE_SERVICE_ROLE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if not SUPABASE_ANON_KEY:
        raise RuntimeError("Thiếu SUPABASE_ANON_KEY. Khuyến nghị dùng SUPABASE_SERVICE_ROLE_KEY để bypass RLS")

    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def ensure_dst_table() -> None:
    """
    Tạo bảng đích nếu có SERVICE ROLE; nếu không, in DDL hướng dẫn.
    Lưu ý: tên bảng có ký tự in hoa -> cần dùng tên có "" khi tạo.
    """
    ddl = (
        f"""
        create table if not exists public."{DST_TABLE}" (
          open_time timestamp without time zone primary key,
          open numeric(38,18) not null,
          high numeric(38,18) not null,
          low numeric(38,18) not null,
          close numeric(38,18) not null,
          volume numeric(38,18) not null,
          tenkan_sen numeric(38,18),
          kijun_sen numeric(38,18),
          senkou_span_a numeric(38,18),
          senkou_span_b numeric(38,18),
          chikou_span numeric(38,18),
          buy_signal boolean,
          sell_signal boolean
        );
        create index if not exists {DST_TABLE.lower()}_time_idx on public."{DST_TABLE}"(open_time);
        """
    ).strip()

    if not SUPABASE_SERVICE_ROLE_KEY:
        print(
            "[INFO] Không có SERVICE ROLE KEY. Hãy tạo bảng thủ công trong Supabase SQL Editor với DDL:\n\n"
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
    import requests

    resp = requests.post(sql_endpoint, headers=headers, data=json.dumps(payload), timeout=60)
    if resp.status_code >= 300:
        raise RuntimeError(f"Tạo bảng đích thất bại: {resp.status_code} {resp.text}")
    print(f"[OK] Đã đảm bảo bảng public.\"{DST_TABLE}\" tồn tại.")


def _parse_open_time_to_dt_utc(open_time_value: Any) -> dt.datetime:
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


def fetch_all_ohlcv_1m(sb: Client, batch: int = 1000) -> pd.DataFrame:
    """
    Lấy toàn bộ dữ liệu từ bảng ohlcv_1m theo batch, trả về DataFrame UTC index.
    """
    all_rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        res = (
            sb.table(SRC_TABLE)
            .select("open_time, open, high, low, close, volume")
            .order("open_time", desc=False)
            .range(offset, offset + batch - 1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
            break
        all_rows.extend(rows)
        # Supabase có thể giới hạn 1000 hàng mỗi request bất kể batch mong muốn
        # nên luôn tăng offset theo số hàng thực nhận
        offset += len(rows)

    if not all_rows:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])  # empty

    df = pd.DataFrame(all_rows)
    df["timestamp"] = df["open_time"].apply(_parse_open_time_to_dt_utc)
    df = df.drop(columns=["open_time"])  # dùng "timestamp" làm index
    # Ép kiểu
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close", "volume"])  # loại bản ghi lỗi
    df = df.sort_values("timestamp")
    df = df.set_index("timestamp")
    return df


def fetch_ohlcv_1m_since(sb: Client, since_utc: dt.datetime, batch: int = 1000) -> pd.DataFrame:
    """
    Lấy dữ liệu từ bảng ohlcv_1m kể từ thời điểm UTC chỉ định.
    """
    all_rows: List[Dict[str, Any]] = []
    offset = 0
    since_str = since_utc.strftime("%Y-%m-%d %H:%M:%S")
    while True:
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

    if not all_rows:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])  # empty

    df = pd.DataFrame(all_rows)
    df["timestamp"] = df["open_time"].apply(_parse_open_time_to_dt_utc)
    df = df.drop(columns=["open_time"]).sort_values("timestamp").set_index("timestamp")
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close", "volume"])  # loại bản ghi lỗi
    return df


def resample_to_5m(df_1m: pd.DataFrame) -> pd.DataFrame:
    if df_1m.empty:
        return df_1m.copy()
    ohlc = df_1m[["open", "high", "low", "close", "volume"]].copy()
    df_5m = pd.DataFrame()
    df_5m["open"] = ohlc["open"].resample("5T").first()
    df_5m["high"] = ohlc["high"].resample("5T").max()
    df_5m["low"] = ohlc["low"].resample("5T").min()
    df_5m["close"] = ohlc["close"].resample("5T").last()
    df_5m["volume"] = ohlc["volume"].resample("5T").sum()
    df_5m = df_5m.dropna(subset=["open", "high", "low", "close"])  # bỏ các khung chưa đủ dữ liệu
    return df_5m


def calculate_ichimoku(
    df: pd.DataFrame,
    tenkan_periods: int = 9,
    kijun_periods: int = 26,
    senkou_b_periods: int = 52,
    offset: int = 26,
) -> pd.DataFrame:
    df = df.copy()
    tenkan_high = df["high"].rolling(window=tenkan_periods).max()
    tenkan_low = df["low"].rolling(window=tenkan_periods).min()
    df["tenkan_sen"] = (tenkan_high + tenkan_low) / 2

    kijun_high = df["high"].rolling(window=kijun_periods).max()
    kijun_low = df["low"].rolling(window=kijun_periods).min()
    df["kijun_sen"] = (kijun_high + kijun_low) / 2

    df["senkou_span_a"] = ((df["tenkan_sen"] + df["kijun_sen"]) / 2).shift(offset)

    senkou_b_high = df["high"].rolling(window=senkou_b_periods).max()
    senkou_b_low = df["low"].rolling(window=senkou_b_periods).min()
    df["senkou_span_b"] = ((senkou_b_high + senkou_b_low) / 2).shift(offset)

    df["chikou_span"] = df["close"].shift(-offset)

    return df


def identify_signals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["kumo_upper"] = df[["senkou_span_a", "senkou_span_b"]].max(axis=1)
    df["kumo_lower"] = df[["senkou_span_a", "senkou_span_b"]].min(axis=1)

    df["tenkan_above_kijun"] = df["tenkan_sen"] > df["kijun_sen"]
    df["tenkan_cross_up"] = (df["tenkan_above_kijun"]) & (~df["tenkan_above_kijun"].shift(1).fillna(False))
    df["tenkan_cross_down"] = (~df["tenkan_above_kijun"]) & (df["tenkan_above_kijun"].shift(1).fillna(False))

    condition1_buy = df["tenkan_cross_up"]
    condition2_buy = df["close"] > df["kumo_upper"]
    df["high_26_ago"] = df["high"].shift(26)
    df["low_26_ago"] = df["low"].shift(26)
    condition3_buy = df["chikou_span"] > df["high_26_ago"]
    df["buy_signal"] = condition1_buy & condition2_buy & condition3_buy

    condition1_sell = df["tenkan_cross_down"]
    condition2_sell = df["close"] < df["kumo_lower"]
    condition3_sell = df["chikou_span"] < df["low_26_ago"]
    df["sell_signal"] = condition1_sell & condition2_sell & condition3_sell

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
    if x is None:
        return None
    try:
        f = float(x)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except Exception:
        return None


def _row_has_full_ichimoku(row: Dict[str, Any]) -> bool:
    return (
        row.get("tenkan_sen") is not None
        and row.get("kijun_sen") is not None
        and row.get("senkou_span_a") is not None
        and row.get("senkou_span_b") is not None
        and row.get("chikou_span") is not None
    )


def upsert_5m_ichimoku(sb: Client, df_5m_ichi: pd.DataFrame, batch_size: int = 500, skip_if_complete: bool = True) -> None:
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

        # Bỏ qua các nến đã đủ Ichimoku nếu được yêu cầu
        if skip_if_complete:
            open_times = [c["open_time"] for c in chunk]
            try:
                exist = (
                    sb.table(DST_TABLE)
                    .select(
                        "open_time, tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b, chikou_span"
                    )
                    .in_("open_time", open_times)
                    .execute()
                )
                existing_rows = {r["open_time"]: r for r in (getattr(exist, "data", None) or [])}
                filtered_chunk = []
                for c in chunk:
                    exist_row = existing_rows.get(c["open_time"])  # type: ignore
                    if exist_row is None:
                        filtered_chunk.append(c)
                    else:
                        if not _row_has_full_ichimoku(exist_row):
                            filtered_chunk.append(c)
                chunk = filtered_chunk
            except Exception:
                # Nếu lỗi khi kiểm tra, fallback upsert toàn bộ chunk
                pass

        if not chunk:
            continue

        _ = (
            sb.table(DST_TABLE)
            .upsert(chunk, on_conflict="open_time", ignore_duplicates=False)
            .execute()
        )
        if (i + batch_size) % (batch_size * 10) == 0:
            print(
                f"[UPSERT] {min(i + batch_size, total)}/{total} (đã lọc {total - len(records)} nếu có)"
            )


def update_only_chikou_and_signals(sb: Client, df_5m_ichi: pd.DataFrame, start_from: Optional[dt.datetime] = None, batch_size: int = 300) -> None:
    """
    Chỉ cập nhật các trường phụ thuộc vào chikou cho các nến đã tồn tại: chikou_span, buy_signal, sell_signal.
    Nếu start_from được cung cấp, chỉ cập nhật các nến có open_time >= start_from.
    """
    if df_5m_ichi.empty:
        return

    df = df_5m_ichi.copy()
    if start_from is not None:
        df = df[df.index >= start_from]
        if df.empty:
            return

    rows: List[Dict[str, Any]] = []
    for ts, row in df.iterrows():
        rows.append(
            {
                "open_time": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "chikou_span": _to_float_or_none(row.get("chikou_span")),
                "buy_signal": bool(row.get("buy_signal")) if pd.notna(row.get("buy_signal")) else None,
                "sell_signal": bool(row.get("sell_signal")) if pd.notna(row.get("sell_signal")) else None,
            }
        )

    total = len(rows)
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        # Cập nhật theo khóa chính open_time
        # Lưu ý: PostgREST không hỗ trợ batch update khác khóa, nên dùng upsert chỉ với các cột cần cập nhật.
        _ = (
            sb.table(DST_TABLE)
            .upsert(chunk, on_conflict="open_time", ignore_duplicates=False)
            .execute()
        )


def _get_latest_dst_open_time(sb: Client) -> Optional[dt.datetime]:
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
    except Exception:
        return None


def build_5m_ichimoku_from_1m() -> None:
    print("[START] Tính Ichimoku 5m từ bảng ohlcv_1m và ghi vào bảng OHLCV_5m_ichi")

    ensure_dst_table()
    sb = get_supabase_client()

    latest_dst = _get_latest_dst_open_time(sb)

    if latest_dst is None:
        # Lần đầu: đọc toàn bộ 1m
        df_1m = fetch_all_ohlcv_1m(sb)
    else:
        # Lần sau: đọc từ trước latest một khoảng lookback để tính được Ichimoku & signals mượt
        lookback_5m = 120  # ~10 giờ lịch sử 5m
        lookback_minutes = lookback_5m * 5
        since_utc = latest_dst - dt.timedelta(minutes=lookback_minutes)
        df_1m = fetch_ohlcv_1m_since(sb, since_utc)

    if df_1m.empty:
        print("[WARN] Không tìm thấy dữ liệu trong bảng ohlcv_1m")
        return

    print(f"[INFO] Đã tải {len(df_1m)} nến 1m từ DB")

    df_5m = resample_to_5m(df_1m)
    print(f"[INFO] Sau resample có {len(df_5m)} nến 5m")

    df_5m_ichi = calculate_ichimoku(df_5m)
    df_5m_ichi = identify_signals(df_5m_ichi)

    # Nếu đã có dữ liệu đích, chỉ upsert phần từ (latest_dst - buffer) trở đi để tránh double tính tín hiệu cạnh biên
    if latest_dst is not None:
        df_5m_ichi = df_5m_ichi[df_5m_ichi.index >= latest_dst - dt.timedelta(minutes=5*2)]

    upsert_5m_ichimoku(sb, df_5m_ichi)
    print("[DONE] Hoàn tất.")


if __name__ == "__main__":
    build_5m_ichimoku_from_1m()


