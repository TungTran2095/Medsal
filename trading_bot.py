"""
Bot giao dịch tự động dựa trên tín hiệu từ bảng OHLCV_5m_ichi trong Supabase.

Logic:
- Khi buy_signal = TRUE: Mua BTC Market với 100% USDT đang có
- Khi sell_signal = TRUE: Bán BTC Market với 100% BTC đang có
- Thực hiện trên tất cả các account trong bảng api_account

Sử dụng:
    python trading_bot.py

Dừng bằng Ctrl+C.
"""

import os
import time
import json
import datetime as dt
from typing import Dict, Any, Optional, List
from decimal import Decimal, ROUND_DOWN

from binance.client import Client as BinanceClient
from binance.exceptions import BinanceAPIException
from supabase import create_client, Client as SupabaseClient
from dotenv import load_dotenv


# Nạp biến môi trường
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SYMBOL = "BTCUSDT"
TABLE_NAME = "OHLCV_5m_ichi"
API_ACCOUNT_TABLE = "api_account"
CHECK_INTERVAL = 60  # Kiểm tra mỗi 60 giây


def get_supabase_client() -> SupabaseClient:
    """
    Tạo Supabase client, ưu tiên SERVICE_ROLE_KEY để bypass RLS.
    """
    if not SUPABASE_URL:
        raise RuntimeError("Thiếu SUPABASE_URL trong file .env")
    
    if SUPABASE_SERVICE_ROLE_KEY:
        print("[INFO] Đang sử dụng SERVICE_ROLE_KEY (bypass RLS)")
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    if not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "Thiếu SUPABASE_ANON_KEY. Nếu bảng có RLS, hãy thêm SUPABASE_SERVICE_ROLE_KEY vào .env"
        )
    
    print("[WARN] Đang sử dụng ANON_KEY. Nếu có lỗi RLS, hãy dùng SERVICE_ROLE_KEY")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_api_accounts(sb: SupabaseClient) -> List[Dict[str, Any]]:
    """
    Lấy danh sách tất cả các account từ bảng api_account.
    Trả về list các dict chứa thông tin account, bao gồm cột config.
    """
    try:
        res = (
            sb.table(API_ACCOUNT_TABLE)
            .select("*")
            .execute()
        )
        accounts = getattr(res, "data", None) or []
        print(f"[INFO] Đã tải {len(accounts)} account từ bảng {API_ACCOUNT_TABLE}")
        return accounts
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy danh sách account: {e}")
        return []


def parse_binance_config(config: Any) -> Optional[Dict[str, Any]]:
    """
    Parse cấu hình Binance từ cột config (có thể là JSON string hoặc dict).
    Trả về dict với keys: api_key, api_secret, isTestnet
    """
    if config is None:
        return None
    
    try:
        if isinstance(config, str):
            config_dict = json.loads(config)
        elif isinstance(config, dict):
            config_dict = config
        else:
            print(f"[WARN] Config không phải string hoặc dict: {type(config)}")
            return None
        
        api_key = config_dict.get("api_key") or config_dict.get("apiKey")
        api_secret = config_dict.get("api_secret") or config_dict.get("apiSecret")
        
        if not api_key or not api_secret:
            print(f"[WARN] Config thiếu api_key hoặc api_secret")
            return None
        
        # Lấy thông tin testnet (mặc định False nếu không có)
        is_testnet = config_dict.get("isTestnet", False)
        if isinstance(is_testnet, str):
            # Nếu là string, chuyển sang boolean
            is_testnet = is_testnet.lower() in ("true", "1", "yes")
        
        return {
            "api_key": str(api_key),
            "api_secret": str(api_secret),
            "isTestnet": bool(is_testnet)
        }
    except json.JSONDecodeError as e:
        print(f"[ERROR] Lỗi parse JSON config: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Lỗi khi parse config: {e}")
        return None


def create_binance_client(api_key: str, api_secret: str, testnet: bool = False) -> BinanceClient:
    """
    Tạo Binance client với API key và secret.
    
    Args:
        api_key: Binance API key
        api_secret: Binance API secret
        testnet: Nếu True, sử dụng Binance Testnet. Mặc định False (Mainnet)
    """
    try:
        client = BinanceClient(api_key, api_secret, testnet=testnet)
        # Test kết nối bằng cách lấy account info
        client.get_account()
        return client
    except Exception as e:
        raise RuntimeError(f"Không thể tạo Binance client: {e}")


def get_balance(client: BinanceClient, asset: str) -> float:
    """
    Lấy số dư của một asset (ví dụ: USDT hoặc BTC).
    """
    try:
        account = client.get_account()
        for balance in account['balances']:
            if balance['asset'] == asset:
                free = float(balance['free'])
                return free
        return 0.0
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy balance {asset}: {e}")
        return 0.0


def get_symbol_precision(client: BinanceClient, symbol: str) -> Dict[str, int]:
    """
    Lấy độ chính xác (số chữ số thập phân) cho quantity và price của symbol.
    """
    try:
        exchange_info = client.get_exchange_info()
        for s in exchange_info['symbols']:
            if s['symbol'] == symbol:
                quantity_precision = None
                price_precision = None
                
                for f in s['filters']:
                    if f['filterType'] == 'LOT_SIZE':
                        step_size = float(f['stepSize'])
                        # Tính số chữ số thập phân từ stepSize
                        if step_size >= 1:
                            quantity_precision = 0
                        else:
                            quantity_precision = len(str(step_size).rstrip('0').split('.')[-1])
                    
                    if f['filterType'] == 'PRICE_FILTER':
                        tick_size = float(f['tickSize'])
                        if tick_size >= 1:
                            price_precision = 0
                        else:
                            price_precision = len(str(tick_size).rstrip('0').split('.')[-1])
                
                return {
                    "quantity": quantity_precision or 8,
                    "price": price_precision or 8
                }
        
        # Default nếu không tìm thấy
        return {"quantity": 8, "price": 8}
    except Exception as e:
        print(f"[WARN] Không thể lấy precision, dùng mặc định: {e}")
        return {"quantity": 8, "price": 8}


def round_down(value: float, decimals: int) -> float:
    """
    Làm tròn xuống số với số chữ số thập phân chỉ định.
    """
    multiplier = 10 ** decimals
    return float(int(value * multiplier) / multiplier)


def place_market_buy(client: BinanceClient, symbol: str, quote_quantity: float) -> Optional[Dict[str, Any]]:
    """
    Đặt lệnh mua Market với số lượng quote asset (ví dụ: USDT).
    """
    try:
        precision = get_symbol_precision(client, symbol)
        
        # Làm tròn quote quantity xuống theo precision của price
        quote_quantity = round_down(quote_quantity, precision["price"])
        
        if quote_quantity <= 0:
            print(f"[WARN] Số lượng quote ({quote_quantity}) không hợp lệ để mua")
            return None
        
        # Lấy giá hiện tại để tính quantity
        ticker = client.get_symbol_ticker(symbol=symbol)
        current_price = float(ticker['price'])
        
        # Tính quantity từ quote quantity
        # Làm tròn xuống để đảm bảo không vượt quá số dư
        base_quantity = quote_quantity / current_price
        base_quantity = round_down(base_quantity, precision["quantity"])
        
        if base_quantity <= 0:
            print(f"[WARN] Số lượng base ({base_quantity}) không hợp lệ để mua")
            return None
        
        print(f"[INFO] Đặt lệnh MUA {symbol} với {quote_quantity} USDT (≈ {base_quantity} BTC @ {current_price})")
        
        # Thử dùng quoteOrderQty trước, nếu không được thì dùng quantity
        try:
            order = client.order_market_buy(
                symbol=symbol,
                quoteOrderQty=quote_quantity
            )
        except:
            # Fallback: dùng quantity nếu quoteOrderQty không được hỗ trợ
            order = client.order_market_buy(
                symbol=symbol,
                quantity=base_quantity
            )
        
        print(f"[SUCCESS] Đã đặt lệnh mua thành công: Order ID = {order['orderId']}")
        return order
    except BinanceAPIException as e:
        print(f"[ERROR] Lỗi Binance API khi mua: {e.message} (code: {e.code})")
        return None
    except Exception as e:
        print(f"[ERROR] Lỗi khi đặt lệnh mua: {e}")
        return None


def place_market_sell(client: BinanceClient, symbol: str, base_quantity: float) -> Optional[Dict[str, Any]]:
    """
    Đặt lệnh bán Market với số lượng base asset (ví dụ: BTC).
    """
    try:
        precision = get_symbol_precision(client, symbol)
        
        # Làm tròn base quantity xuống theo precision của quantity
        base_quantity = round_down(base_quantity, precision["quantity"])
        
        if base_quantity <= 0:
            print(f"[WARN] Số lượng base ({base_quantity}) không hợp lệ để bán")
            return None
        
        print(f"[INFO] Đặt lệnh BÁN {symbol} với {base_quantity} BTC")
        order = client.order_market_sell(
            symbol=symbol,
            quantity=base_quantity
        )
        
        print(f"[SUCCESS] Đã đặt lệnh bán thành công: Order ID = {order['orderId']}")
        return order
    except BinanceAPIException as e:
        print(f"[ERROR] Lỗi Binance API khi bán: {e.message} (code: {e.code})")
        return None
    except Exception as e:
        print(f"[ERROR] Lỗi khi đặt lệnh bán: {e}")
        return None


def get_latest_signal(sb: SupabaseClient) -> Optional[Dict[str, Any]]:
    """
    Lấy bản ghi mới nhất từ bảng OHLCV_5m_ichi để kiểm tra buy_signal và sell_signal.
    """
    try:
        res = (
            sb.table(TABLE_NAME)
            .select("open_time, buy_signal, sell_signal")
            .order("open_time", desc=True)
            .limit(1)
            .execute()
        )
        
        data = getattr(res, "data", None) or []
        if not data:
            return None
        
        return data[0]
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy tín hiệu từ Supabase: {e}")
        return None


def process_trading_signals():
    """
    Hàm chính xử lý tín hiệu giao dịch.
    """
    print("=" * 60)
    print("🤖 BOT GIAO DỊCH TỰ ĐỘNG")
    print("=" * 60)
    
    # Kết nối Supabase
    try:
        sb = get_supabase_client()
        print(f"[INFO] Đã kết nối Supabase: {SUPABASE_URL}")
    except Exception as e:
        print(f"[ERROR] Không thể kết nối Supabase: {e}")
        return
    
    # Lấy danh sách accounts
    accounts = get_api_accounts(sb)
    if not accounts:
        print("[ERROR] Không có account nào để giao dịch")
        return
    
    print(f"[INFO] Symbol: {SYMBOL}")
    print(f"[INFO] Bảng tín hiệu: {TABLE_NAME}")
    print(f"[INFO] Kiểm tra mỗi {CHECK_INTERVAL} giây\n")
    
    last_processed_time = None
    
    try:
        while True:
            # Lấy tín hiệu mới nhất
            latest_signal = get_latest_signal(sb)
            
            if not latest_signal:
                print(f"[WARN] Không tìm thấy tín hiệu trong bảng {TABLE_NAME}")
                time.sleep(CHECK_INTERVAL)
                continue
            
            open_time = latest_signal.get("open_time")
            buy_signal = latest_signal.get("buy_signal")
            sell_signal = latest_signal.get("sell_signal")
            
            # Chỉ xử lý nếu là bản ghi mới (chưa xử lý)
            if last_processed_time and open_time == last_processed_time:
                time.sleep(CHECK_INTERVAL)
                continue
            
            print(f"\n[CHECK] Kiểm tra tín hiệu tại {open_time}")
            print(f"  - buy_signal: {buy_signal}")
            print(f"  - sell_signal: {sell_signal}")
            
            # Xử lý từng account
            for account in accounts:
                account_id = account.get("id") or account.get("account_id") or "unknown"
                config = account.get("config")
                
                print(f"\n[ACCOUNT] Xử lý account ID: {account_id}")
                
                # Parse config
                binance_config = parse_binance_config(config)
                if not binance_config:
                    print(f"[SKIP] Account {account_id}: Không có config hợp lệ")
                    continue
                
                # Tạo Binance client
                try:
                    is_testnet = binance_config.get("isTestnet", False)
                    network_type = "TESTNET" if is_testnet else "MAINNET"
                    print(f"[NETWORK] Account {account_id}: Sử dụng {network_type}")
                    
                    client = create_binance_client(
                        binance_config["api_key"],
                        binance_config["api_secret"],
                        testnet=is_testnet
                    )
                except Exception as e:
                    print(f"[ERROR] Account {account_id}: Không thể tạo Binance client: {e}")
                    continue
                
                # Xử lý buy signal (ưu tiên mua trước)
                if buy_signal is True:
                    print(f"[SIGNAL] buy_signal = TRUE → Mua BTC Market")
                    usdt_balance = get_balance(client, "USDT")
                    print(f"[BALANCE] USDT: {usdt_balance}")
                    
                    if usdt_balance > 0:
                        # Mua với 100% USDT
                        order = place_market_buy(client, SYMBOL, usdt_balance)
                        if order:
                            print(f"[SUCCESS] Account {account_id}: Đã mua thành công")
                        else:
                            print(f"[FAILED] Account {account_id}: Mua thất bại")
                    else:
                        print(f"[SKIP] Account {account_id}: Không có USDT để mua")
                
                # Xử lý sell signal (chỉ bán nếu không có buy signal)
                elif sell_signal is True:
                    print(f"[SIGNAL] sell_signal = TRUE → Bán BTC Market")
                    btc_balance = get_balance(client, "BTC")
                    print(f"[BALANCE] BTC: {btc_balance}")
                    
                    if btc_balance > 0:
                        # Bán với 100% BTC
                        order = place_market_sell(client, SYMBOL, btc_balance)
                        if order:
                            print(f"[SUCCESS] Account {account_id}: Đã bán thành công")
                        else:
                            print(f"[FAILED] Account {account_id}: Bán thất bại")
                    else:
                        print(f"[SKIP] Account {account_id}: Không có BTC để bán")
                else:
                    print(f"[SKIP] Account {account_id}: Không có tín hiệu giao dịch")
            
            # Đánh dấu đã xử lý
            last_processed_time = open_time
            
            print(f"\n[WAIT] Đợi {CHECK_INTERVAL} giây trước khi kiểm tra lại...\n")
            time.sleep(CHECK_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n[STOP] Bot đã dừng bởi người dùng")
    except Exception as e:
        print(f"\n[ERROR] Lỗi không mong đợi: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    process_trading_signals()

