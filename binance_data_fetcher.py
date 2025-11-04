from tradingview_ta import TA_Handler, Interval
import pandas as pd
from datetime import datetime, timedelta
import requests
import time



def calculate_ichimoku(df, tenkan_periods=9, kijun_periods=26, senkou_b_periods=52, offset=26):
    """
    """
    df = df.copy()
    
    # 1. Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
    tenkan_high = df['high'].rolling(window=tenkan_periods).max()
    tenkan_low = df['low'].rolling(window=tenkan_periods).min()
    df['tenkan_sen'] = (tenkan_high + tenkan_low) / 2
    
    # 2. Kijun-sen (Base Line): (26-period high + 26-period low) / 2
    kijun_high = df['high'].rolling(window=kijun_periods).max()
    kijun_low = df['low'].rolling(window=kijun_periods).min()
    df['kijun_sen'] = (kijun_high + kijun_low) / 2
    
    # 3. Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, shift về trước offset periods
    df['senkou_span_a'] = ((df['tenkan_sen'] + df['kijun_sen']) / 2).shift(offset)
    
    # 4. Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, shift về trước offset periods
    senkou_b_high = df['high'].rolling(window=senkou_b_periods).max()
    senkou_b_low = df['low'].rolling(window=senkou_b_periods).min()
    df['senkou_span_b'] = ((senkou_b_high + senkou_b_low) / 2).shift(offset)
    
    # 5. Chikou Span (Lagging Span): Giá đóng cửa hiện tại, shift về sau offset periods
    df['chikou_span'] = df['close'].shift(-offset)
    
    # Xóa các giá trị NaN ở đầu và cuối
    # df = df.dropna()
    
    return df


def get_ichimoku_data(symbol='BTCUSDT', start_date=None, end_date=None, days=100):
    """
    Lấy dữ liệu OHLCV với timeframe 5m và tính các chỉ số Ichimoku
    Hỗ trợ lấy unlimited rows bằng cách gọi nhiều batch requests
    
    Parameters:
    - symbol: Cặp giao dịch (mặc định: BTCUSDT)
    - start_date: Ngày bắt đầu (format: 'YYYY-MM-DD') - nếu None thì dùng days
    - end_date: Ngày kết thúc (format: 'YYYY-MM-DD') - nếu None thì dùng ngày hiện tại
    - days: Số ngày dữ liệu cần lấy (chỉ dùng khi start_date và end_date là None)
    
    Returns:
    - DataFrame với dữ liệu OHLCV và các chỉ số Ichimoku (timestamp ở GMT+7)
    """
    klines_url = "https://api.binance.com/api/v3/klines"
    
    # Tính toán thời gian bắt đầu và kết thúc
    if start_date and end_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        # Thêm thời gian cuối ngày cho end_date
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
    else:
        # Nếu không có start_date/end_date, tính từ số ngày
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=days)
    
    # Chuyển đổi sang timestamp (milliseconds)
    start_timestamp = int(start_dt.timestamp() * 1000)
    end_timestamp = int(end_dt.timestamp() * 1000)
    
    print(f"Đang lấy dữ liệu {symbol} timeframe 5m...")
    print(f"Từ {start_dt.strftime('%Y-%m-%d %H:%M:%S')} đến {end_dt.strftime('%Y-%m-%d %H:%M:%S')}")
    
    all_data = []
    current_start = start_timestamp
    batch_count = 0
    max_limit = 1000  # Binance giới hạn 1000 nến mỗi request
    interval_ms = 5 * 60 * 1000  # 5 phút = 5 * 60 * 1000 milliseconds
    
    # Lấy dữ liệu theo batch
    while current_start < end_timestamp:
        batch_count += 1
        # Tính timestamp kết thúc cho batch này (1000 nến * 5 phút)
        batch_end = min(current_start + (max_limit * interval_ms), end_timestamp)
        
        params = {
            'symbol': symbol,
            'interval': '5m',
            'limit': max_limit,
            'startTime': current_start,
            'endTime': batch_end
        }
        
        try:
            response = requests.get(klines_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if not data:
                break
            
            all_data.extend(data)
            print(f"  Batch {batch_count}: Lấy được {len(data)} nến...")
            
            # Cập nhật start time cho batch tiếp theo (timestamp của nến cuối + 1 interval)
            if len(data) > 0:
                current_start = data[-1][0] + interval_ms
            else:
                break
            
            # Tránh rate limit của Binance
            time.sleep(0.1)
            
        except Exception as e:
            print(f"Lỗi khi lấy batch {batch_count}: {e}")
            break
    
    if not all_data:
        raise Exception("Không lấy được dữ liệu từ Binance")
    
    print(f"✓ Tổng cộng lấy được {len(all_data)} nến từ {batch_count} batch(es)")
    
    # Chuyển thành DataFrame
    df = pd.DataFrame(all_data, columns=[
        'open_time', 'open', 'high', 'low', 'close', 'volume',
        'close_time', 'quote_asset_volume', 'number_of_trades',
        'taker_buy_base', 'taker_buy_quote', 'ignore'
    ])
    
    # Chuyển đổi kiểu dữ liệu
    # Chuyển timestamp từ UTC sang GMT+7 (UTC+7 = Asia/Ho_Chi_Minh)
    df['open_time'] = pd.to_datetime(df['open_time'], unit='ms', utc=True)
    try:
        # Thử dùng timezone có sẵn trong hệ thống
        df['open_time'] = df['open_time'].dt.tz_convert('Asia/Ho_Chi_Minh')
        # Bỏ timezone info, chỉ giữ thời gian đã convert
        df['open_time'] = df['open_time'].dt.tz_localize(None)
    except:
        # Nếu không có timezone, dùng offset trực tiếp (UTC+7)
        df['open_time'] = df['open_time'].dt.tz_localize(None)
        df['open_time'] = df['open_time'] + timedelta(hours=7)
    
    df[['open', 'high', 'low', 'close', 'volume']] = df[['open', 'high', 'low', 'close', 'volume']].astype(float)
    
    # Loại bỏ duplicate nếu có
    df = df.drop_duplicates(subset=['open_time'])
    
    # Giữ lại các cột chính
    df = df[['open_time', 'open', 'high', 'low', 'close', 'volume']]
    df.rename(columns={'open_time': 'timestamp'}, inplace=True)
    df.set_index('timestamp', inplace=True)
    df = df.sort_index()  # Sắp xếp theo thời gian
    
    # Tính Ichimoku
    print("Đang tính toán các chỉ số Ichimoku...")
    df = calculate_ichimoku(df)
    
    return df


def identify_signals(df):
    """
    Xác định Buy và Sell signals dựa trên Ichimoku
    
    Buy signals khi:
    - tenkan cắt lên kijun (tenkan > kijun và trước đó tenkan <= kijun)
    - Giá trên mây kumo (close > max(senkou_span_a, senkou_span_b))
    - chikou > giá high 26 kỳ trước
    
    Sell signals khi:
    - tenkan cắt xuống kijun (tenkan < kijun và trước đó tenkan >= kijun)
    - Giá dưới mây kumo (close < min(senkou_span_a, senkou_span_b))
    - chikou < giá low 26 kỳ trước
    
    Parameters:
    - df: DataFrame có chứa các chỉ số Ichimoku
    
    Returns:
    - DataFrame với thêm các cột: 'buy_signal', 'sell_signal'
    """
    df = df.copy()
    
    # Tính mây Kumo (upper và lower)
    df['kumo_upper'] = df[['senkou_span_a', 'senkou_span_b']].max(axis=1)
    df['kumo_lower'] = df[['senkou_span_a', 'senkou_span_b']].min(axis=1)
    
    # Xác định tenkan cắt kijun
    df['tenkan_above_kijun'] = df['tenkan_sen'] > df['kijun_sen']
    df['tenkan_cross_up'] = (df['tenkan_above_kijun']) & (~df['tenkan_above_kijun'].shift(1).fillna(False))
    df['tenkan_cross_down'] = (~df['tenkan_above_kijun']) & (df['tenkan_above_kijun'].shift(1).fillna(False))
    
    # Điều kiện Buy Signal
    # 1. tenkan cắt lên kijun
    condition1_buy = df['tenkan_cross_up']
    
    # 2. Giá trên mây kumo
    condition2_buy = df['close'] > df['kumo_upper']
    
    # 3. chikou > giá high 26 kỳ trước
    # Chikou span đã được shift(-26), nên chikou_span[t] = close[t+26]
    # Để so sánh với high 26 kỳ trước, ta cần shift(26) để lấy high của 26 kỳ trước
    # Nhưng vì chikou đã là giá tương lai, ta so sánh với high hiện tại shift(26)
    # Thực tế: chikou_span[t] = close[t+26], ta muốn so sánh với high[t-26]
    # Vì chikou shift(-26), để so sánh đúng ta dùng: chikou_span[t] > high[t].shift(52)
    # Hoặc đơn giản hơn: dùng close hiện tại > high 26 kỳ trước
    # Vì chikou là giá đóng cửa, ta so sánh: close[t] > high[t].shift(26)
    # Nhưng do chikou đã shift(-26), nên ta cần shift ngược lại
    df['high_26_ago'] = df['high'].shift(26)
    df['low_26_ago'] = df['low'].shift(26)
    # Chikou span tại thời điểm t (sau khi shift -26) là giá close của t+26
    # Để so sánh với high 26 kỳ trước tại thời điểm t, ta dùng high.shift(26)
    # Nhưng vì cần so sánh với high 26 kỳ trước của thời điểm hiện tại (t), ta dùng:
    condition3_buy = df['chikou_span'] > df['high_26_ago']  # chikou > high 26 kỳ trước
    
    df['buy_signal'] = condition1_buy & condition2_buy & condition3_buy
    
    # Điều kiện Sell Signal
    # 1. tenkan cắt xuống kijun
    condition1_sell = df['tenkan_cross_down']
    
    # 2. Giá dưới mây kumo
    condition2_sell = df['close'] < df['kumo_lower']
    
    # 3. chikou < giá low 26 kỳ trước
    condition3_sell = df['chikou_span'] < df['low_26_ago']  # chikou < low 26 kỳ trước
    
    df['sell_signal'] = condition1_sell & condition2_sell & condition3_sell
    
    # Xóa các cột tạm
    df = df.drop(columns=['kumo_upper', 'kumo_lower', 'high_26_ago', 'low_26_ago', 
                          'tenkan_above_kijun', 'tenkan_cross_up', 'tenkan_cross_down'])
    
    return df


def backtest_ichimoku(df, initial_capital=10000, take_profit_pct=0.02, stop_loss_pct=0.01,
                      taker_fee_pct=0.001, maker_fee_pct=0.001, execution_type='taker'):
    """
    Chạy backtest với chiến lược Ichimoku
    
    Parameters:
    - df: DataFrame có chứa dữ liệu OHLCV và các chỉ số Ichimoku (đã có signals)
    - initial_capital: Vốn ban đầu (mặc định: 10000 USD)
    - take_profit_pct: Tỷ lệ take profit (ví dụ: 0.02 = 2%)
    - stop_loss_pct: Tỷ lệ stop loss (ví dụ: 0.01 = 1%)
    
    Returns:
    - Dictionary chứa kết quả backtest và danh sách các giao dịch
    """
    df = df.copy()
    
    # Khởi tạo biến
    capital = initial_capital
    position = None  # None, hoặc dict chứa thông tin position: {'entry_price', 'entry_time', 'quantity', 'cost_basis'}
    trades = []
    equity_curve = []
    
    # Lọc dữ liệu có đầy đủ thông tin
    df = df.dropna(subset=['tenkan_sen', 'kijun_sen', 'senkou_span_a', 'senkou_span_b', 'chikou_span'])
    
    for idx, row in df.iterrows():
        current_price = row['close']
        high_price = row['high']
        low_price = row['low']
        
        # Nếu có position (đã mua)
        if position is not None:
            entry_price = position['entry_price']
            
            # Tính toán take profit và stop loss
            take_profit_price = entry_price * (1 + take_profit_pct)
            stop_loss_price = entry_price * (1 - stop_loss_pct)
            
            # ƯU TIÊN 1: Kiểm tra Take Profit
            if high_price >= take_profit_price:
                # Bán với giá take profit
                sell_price = take_profit_price
                fee_rate = taker_fee_pct if execution_type.lower() == 'taker' else maker_fee_pct
                gross_revenue = position['quantity'] * sell_price
                exit_fee = gross_revenue * fee_rate
                net_revenue = gross_revenue - exit_fee
                profit = net_revenue - position['cost_basis']
                capital += net_revenue
                
                trades.append({
                    'entry_time': position['entry_time'],
                    'exit_time': idx,
                    'entry_price': entry_price,
                    'exit_price': sell_price,
                    'quantity': position['quantity'],
                    'profit': profit,
                    'profit_pct': (profit / position['cost_basis']) * 100,
                    'exit_reason': 'Take Profit',
                    'fee_entry': position['entry_fee'],
                    'fee_exit': exit_fee
                })
                
                position = None
                
            # ƯU TIÊN 2: Kiểm tra Stop Loss
            elif low_price <= stop_loss_price:
                # Bán với giá stop loss
                sell_price = stop_loss_price
                fee_rate = taker_fee_pct if execution_type.lower() == 'taker' else maker_fee_pct
                gross_revenue = position['quantity'] * sell_price
                exit_fee = gross_revenue * fee_rate
                net_revenue = gross_revenue - exit_fee
                profit = net_revenue - position['cost_basis']
                capital += net_revenue
                
                trades.append({
                    'entry_time': position['entry_time'],
                    'exit_time': idx,
                    'entry_price': entry_price,
                    'exit_price': sell_price,
                    'quantity': position['quantity'],
                    'profit': profit,
                    'profit_pct': (profit / position['cost_basis']) * 100,
                    'exit_reason': 'Stop Loss',
                    'fee_entry': position['entry_fee'],
                    'fee_exit': exit_fee
                })
                
                position = None
                
            # ƯU TIÊN 3: Kiểm tra Sell Signal
            elif row['sell_signal']:
                # Bán với giá đóng cửa hiện tại
                sell_price = current_price
                fee_rate = taker_fee_pct if execution_type.lower() == 'taker' else maker_fee_pct
                gross_revenue = position['quantity'] * sell_price
                exit_fee = gross_revenue * fee_rate
                net_revenue = gross_revenue - exit_fee
                profit = net_revenue - position['cost_basis']
                capital += net_revenue
                
                trades.append({
                    'entry_time': position['entry_time'],
                    'exit_time': idx,
                    'entry_price': entry_price,
                    'exit_price': sell_price,
                    'quantity': position['quantity'],
                    'profit': profit,
                    'profit_pct': (profit / position['cost_basis']) * 100,
                    'exit_reason': 'Sell Signal',
                    'fee_entry': position['entry_fee'],
                    'fee_exit': exit_fee
                })
                
                position = None
        
        # Nếu không có position và có Buy Signal
        elif row['buy_signal'] and capital > 0:
            # Mua với giá đóng cửa hiện tại (áp dụng phí)
            buy_price = current_price
            fee_rate = taker_fee_pct if execution_type.lower() == 'taker' else maker_fee_pct
            # Số lượng phải trừ phí giao dịch khi mua: cost = qty * price * (1 + fee)
            quantity = capital / (buy_price * (1 + fee_rate))
            entry_gross_cost = quantity * buy_price
            entry_fee = entry_gross_cost * fee_rate
            cost_basis = entry_gross_cost + entry_fee
            
            position = {
                'entry_price': buy_price,
                'entry_time': idx,
                'quantity': quantity,
                'cost_basis': cost_basis,
                'entry_fee': entry_fee
            }
            
            capital = 0  # Đã dùng hết vốn để mua (sau khi tính phí)
    
        # Ghi lại equity curve
        if position is not None:
            current_equity = position['quantity'] * current_price
        else:
            current_equity = capital
        
        equity_curve.append({
            'timestamp': idx,
            'equity': current_equity
        })
    
    # Nếu còn position ở cuối, bán với giá cuối cùng
    if position is not None:
        last_price = df.iloc[-1]['close']
        fee_rate = taker_fee_pct if execution_type.lower() == 'taker' else maker_fee_pct
        gross_revenue = position['quantity'] * last_price
        exit_fee = gross_revenue * fee_rate
        net_revenue = gross_revenue - exit_fee
        profit = net_revenue - position['cost_basis']
        capital = net_revenue
        
        trades.append({
            'entry_time': position['entry_time'],
            'exit_time': df.index[-1],
            'entry_price': position['entry_price'],
            'exit_price': last_price,
            'quantity': position['quantity'],
            'profit': profit,
            'profit_pct': (profit / position['cost_basis']) * 100,
            'exit_reason': 'End of Data',
            'fee_entry': position['entry_fee'],
            'fee_exit': exit_fee
        })
    
    # Tính toán kết quả
    final_capital = capital if position is None else position['quantity'] * df.iloc[-1]['close']
    total_return = final_capital - initial_capital
    total_return_pct = (final_capital / initial_capital - 1) * 100
    
    winning_trades = [t for t in trades if t['profit'] > 0]
    losing_trades = [t for t in trades if t['profit'] <= 0]
    
    win_rate = len(winning_trades) / len(trades) * 100 if trades else 0
    
    avg_profit = sum(t['profit'] for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t['profit'] for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    # Tính profit factor
    total_profit = sum(t['profit'] for t in winning_trades) if winning_trades else 0
    total_loss = abs(sum(t['profit'] for t in losing_trades)) if losing_trades else 1
    profit_factor = total_profit / total_loss if total_loss > 0 else 0
    
    results = {
        'initial_capital': initial_capital,
        'final_capital': final_capital,
        'total_return': total_return,
        'total_return_pct': total_return_pct,
        'total_trades': len(trades),
        'winning_trades': len(winning_trades),
        'losing_trades': len(losing_trades),
        'win_rate': win_rate,
        'avg_profit': avg_profit,
        'avg_loss': avg_loss,
        'profit_factor': profit_factor,
        'trades': trades,
        'equity_curve': equity_curve
    }
    
    return results


# === SỬ DỤNG HÀM ===
if __name__ == "__main__":
    print("=" * 70)
    print("Backtest Chiến lược Ichimoku (timeframe 5m)")
    print("=" * 70)
    
    # Nhập thông tin từ người dùng
    symbol = input("\nNhập cặp giao dịch (mặc định: BTCUSDT): ").strip().upper() or 'BTCUSDT'
    start_date = input("Nhập ngày bắt đầu (YYYY-MM-DD, để trống lấy 100 ngày gần nhất): ").strip() or None
    end_date = input("Nhập ngày kết thúc (YYYY-MM-DD, để trống lấy đến hiện tại): ").strip() or None
    
    if start_date and end_date:
        df = get_ichimoku_data(symbol=symbol, start_date=start_date, end_date=end_date)
    else:
        days = input("Nhập số ngày dữ liệu cần lấy (mặc định: 100): ").strip()
        days = int(days) if days else 100
        df = get_ichimoku_data(symbol=symbol, days=days)
    
    print(f"\n✓ Đã lấy được {len(df)} nến")
    
    # Nhập thông tin backtest
    print("\n" + "=" * 70)
    print("Cấu hình Backtest")
    print("=" * 70)
    
    initial_capital = input("Nhập vốn ban đầu (USD, mặc định: 10000): ").strip()
    initial_capital = float(initial_capital) if initial_capital else 10000
    
    take_profit_pct = input("Nhập tỷ lệ Take Profit (ví dụ: 0.02 = 2%, mặc định: 0.02): ").strip()
    take_profit_pct = float(take_profit_pct) if take_profit_pct else 0.02
    
    stop_loss_pct = input("Nhập tỷ lệ Stop Loss (ví dụ: 0.01 = 1%, mặc định: 0.01): ").strip()
    stop_loss_pct = float(stop_loss_pct) if stop_loss_pct else 0.01

    # Phí giao dịch (đơn vị % nhập vào, ví dụ 0.1 = 0.1%)
    taker_fee_input = input("Nhập phí Taker (%) (mặc định: 0.1): ").strip()
    maker_fee_input = input("Nhập phí Maker (%) (mặc định: 0.1): ").strip()
    # Chuyển sang dạng thập phân
    try:
        taker_fee_pct = (float(taker_fee_input) / 100.0) if taker_fee_input else 0.001
    except:
        taker_fee_pct = 0.001
    try:
        maker_fee_pct = (float(maker_fee_input) / 100.0) if maker_fee_input else 0.001
    except:
        maker_fee_pct = 0.001

    # Kiểu khớp lệnh mặc định
    execution_type = input("Chọn loại khớp lệnh mặc định (taker/maker, mặc định: taker): ").strip().lower() or 'taker'
    if execution_type not in ['taker', 'maker']:
        execution_type = 'taker'
    
    # Xác định signals
    print("\nĐang xác định Buy/Sell signals...")
    df = identify_signals(df)
    
    # Đếm số signals
    buy_signals = df['buy_signal'].sum()
    sell_signals = df['sell_signal'].sum()
    print(f"✓ Tìm thấy {buy_signals} Buy signals và {sell_signals} Sell signals")
    
    # Chạy backtest
    print("\nĐang chạy backtest...")
    results = backtest_ichimoku(df, initial_capital, take_profit_pct, stop_loss_pct,
                                 taker_fee_pct=taker_fee_pct, maker_fee_pct=maker_fee_pct,
                                 execution_type=execution_type)
    
    # Hiển thị kết quả
    print("\n" + "=" * 70)
    print("KẾT QUẢ BACKTEST")
    print("=" * 70)
    print(f"Vốn ban đầu:        ${results['initial_capital']:,.2f}")
    print(f"Vốn cuối cùng:      ${results['final_capital']:,.2f}")
    print(f"Lãi/Lỗ:             ${results['total_return']:,.2f}")
    print(f"Tỷ suất lợi nhuận:  {results['total_return_pct']:.2f}%")
    print(f"\nTổng số giao dịch:  {results['total_trades']}")
    print(f"Giao dịch thắng:    {results['winning_trades']}")
    print(f"Giao dịch thua:     {results['losing_trades']}")
    print(f"Tỷ lệ thắng:        {results['win_rate']:.2f}%")
    print(f"\nLợi nhuận TB:       ${results['avg_profit']:,.2f}")
    print(f"Thua lỗ TB:         ${results['avg_loss']:,.2f}")
    print(f"Profit Factor:      {results['profit_factor']:.2f}")
    
    # Hiển thị một số giao dịch gần nhất
    if results['trades']:
        print("\n" + "=" * 70)
        print("10 GIAO DỊCH GẦN NHẤT")
        print("=" * 70)
        trades_df = pd.DataFrame(results['trades'][-10:])
        trades_df['entry_time'] = pd.to_datetime(trades_df['entry_time'])
        trades_df['exit_time'] = pd.to_datetime(trades_df['exit_time'])
        print(trades_df.to_string(index=False))
    
    # Lưu kết quả
    save_results = input("\nLưu kết quả vào file? (y/n, mặc định: y): ").strip().lower()
    if save_results != 'n':
        # Lưu dữ liệu với signals
        filename_data = f"{symbol}_5m_ichimoku_signals.csv"
        df.to_csv(filename_data)
        print(f"✓ Đã lưu dữ liệu với signals vào {filename_data}")
        
        # Lưu danh sách trades
        if results['trades']:
            filename_trades = f"{symbol}_5m_backtest_trades.csv"
            trades_df = pd.DataFrame(results['trades'])
            trades_df.to_csv(filename_trades, index=False)
            print(f"✓ Đã lưu danh sách trades vào {filename_trades}")
        
        # Lưu equity curve
        filename_equity = f"{symbol}_5m_backtest_equity.csv"
        equity_df = pd.DataFrame(results['equity_curve'])
        equity_df['timestamp'] = pd.to_datetime(equity_df['timestamp'])
        equity_df.to_csv(filename_equity, index=False)
        print(f"✓ Đã lưu equity curve vào {filename_equity}")