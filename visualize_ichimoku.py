import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.widgets import Cursor
from matplotlib.patches import Rectangle
from datetime import datetime
import numpy as np

# Sử dụng interactive backend nếu có thể
try:
    import matplotlib
    # Thử sử dụng backend tương tác tốt hơn
    if matplotlib.get_backend() == 'Agg':
        # Nếu đang dùng non-interactive backend, thử chuyển sang interactive
        try:
            matplotlib.use('TkAgg')
        except:
            try:
                matplotlib.use('Qt5Agg')
            except:
                pass
except:
    pass

def load_ichimoku_data(csv_file):
    """
    Đọc dữ liệu Ichimoku từ file CSV
    Định dạng timestamp: dd/mm/yyyy hh:mm (ví dụ: 07/04/2024 21:45)
    """
    try:
        # Đọc CSV với định dạng timestamp: dd/mm/yyyy hh:mm
        df = pd.read_csv(csv_file)
        
        # Parse timestamp với format cụ thể: dd/mm/yyyy hh:mm
        # Thử nhiều format để đảm bảo tương thích
        try:
            df['timestamp'] = pd.to_datetime(df['timestamp'], format='%d/%m/%Y %H:%M')
        except ValueError:
            # Nếu không parse được, thử format khác
            try:
                df['timestamp'] = pd.to_datetime(df['timestamp'], format='%d-%m-%y %H:%M')
            except ValueError:
                # Fallback: để pandas tự detect
                df['timestamp'] = pd.to_datetime(df['timestamp'], dayfirst=True)
        
        df.set_index('timestamp', inplace=True)
        
        # Chuyển đổi boolean từ TRUE/FALSE (string) sang True/False (bool)
        if 'buy_signal' in df.columns:
            if df['buy_signal'].dtype == 'object':
                df['buy_signal'] = df['buy_signal'].astype(str).str.upper() == 'TRUE'
            elif df['buy_signal'].dtype == 'bool':
                pass  # Đã đúng rồi
            else:
                df['buy_signal'] = df['buy_signal'].astype(bool)
        
        if 'sell_signal' in df.columns:
            if df['sell_signal'].dtype == 'object':
                df['sell_signal'] = df['sell_signal'].astype(str).str.upper() == 'TRUE'
            elif df['sell_signal'].dtype == 'bool':
                pass  # Đã đúng rồi
            else:
                df['sell_signal'] = df['sell_signal'].astype(bool)
        
        return df
    except FileNotFoundError:
        print(f"Lỗi: Không tìm thấy file {csv_file}")
        return None
    except Exception as e:
        print(f"Lỗi khi đọc file {csv_file}: {e}")
        return None

def plot_ichimoku(df, signals_df=None, start_date=None, end_date=None, figsize=(16, 10), interactive=True):
    """
    Vẽ biểu đồ Ichimoku với các tín hiệu buy/sell
    
    Parameters:
    - df: DataFrame chứa dữ liệu Ichimoku
    - signals_df: DataFrame chứa signals (nếu có)
    - start_date: Ngày bắt đầu hiển thị (string hoặc datetime)
    - end_date: Ngày kết thúc hiển thị (string hoặc datetime)
    - figsize: Kích thước biểu đồ
    - interactive: Nếu True, hiển thị toàn bộ dữ liệu để có thể scroll/zoom
    """
    # Lưu toàn bộ dữ liệu gốc để có thể scroll
    df_full = df.copy()
    
    # Lọc dữ liệu theo khoảng thời gian nếu có
    if start_date:
        if isinstance(start_date, str):
            start_date = pd.to_datetime(start_date)
        df = df[df.index >= start_date]
    
    if end_date:
        if isinstance(end_date, str):
            end_date = pd.to_datetime(end_date)
        df = df[df.index <= end_date]
    
    # Nếu interactive mode, giữ toàn bộ dữ liệu để có thể scroll/zoom
    # Nếu không, giới hạn để tránh quá tải khi lưu file
    if not interactive:
        if len(df) > 2000:
            print(f"Cảnh báo: Quá nhiều dữ liệu ({len(df)} rows). Chỉ hiển thị 2000 rows cuối cùng.")
            df = df.tail(2000)
    
    # Tạo figure với 2 subplots
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=figsize, height_ratios=[3, 1])
    
    # Subplot 1: Biểu đồ giá và Ichimoku
    ax1.set_title('Biểu đồ Ichimoku - BTCUSDT 5m', fontsize=16, fontweight='bold')
    
    # Vẽ nến (candlestick) từ dữ liệu OHLC
    def plot_candlestick(ax, df, width_ratio=0.6):
        """
        Vẽ biểu đồ nến từ dữ liệu OHLC
        """
        # Lọc dữ liệu có đủ OHLC
        valid_data = df.dropna(subset=['open', 'high', 'low', 'close'])
        
        if len(valid_data) == 0:
            print("Cảnh báo: Không có dữ liệu OHLC hợp lệ để vẽ nến")
            return None
        
        # Tính toán chiều rộng nến dựa trên khoảng cách giữa các điểm thời gian
        if len(valid_data) > 1:
            # Chuyển đổi timestamp sang số ngày (matplotlib date format)
            time_diff = mdates.date2num(valid_data.index[1]) - mdates.date2num(valid_data.index[0])
            width_days = time_diff * width_ratio  # 60% khoảng cách
        else:
            # Giá trị mặc định cho 5 phút timeframe
            width_days = 5 / (24 * 60) * width_ratio  # 5 phút = 5/(24*60) ngày
        
        # Tách nến tăng (bullish - xanh) và nến giảm (bearish - đỏ)
        bullish = valid_data[valid_data['close'] >= valid_data['open']]
        bearish = valid_data[valid_data['close'] < valid_data['open']]
        
        # Vẽ wick (bóng nến) - đường thẳng từ high đến low
        for idx, row in valid_data.iterrows():
            x_pos = mdates.date2num(idx)
            ax.plot([x_pos, x_pos], [row['low'], row['high']], 
                   color='black', linewidth=0.8, alpha=0.8, zorder=1)
        
        # Vẽ body của nến tăng (bullish - màu xanh)
        if len(bullish) > 0:
            for idx, row in bullish.iterrows():
                open_price = row['open']
                close_price = row['close']
                body_bottom = min(open_price, close_price)
                body_top = max(open_price, close_price)
                body_height = body_top - body_bottom
                
                # Nếu body quá nhỏ, đặt chiều cao tối thiểu để nhìn thấy
                if body_height < (body_top * 0.001):  # Nếu nhỏ hơn 0.1% giá
                    body_height = body_top * 0.001
                    body_bottom = body_top - body_height
                
                x_pos = mdates.date2num(idx)
                # Vẽ body
                rect = plt.Rectangle((x_pos - width_days/2, body_bottom),
                                    width_days, body_height,
                                    facecolor='#2ecc71', edgecolor='#27ae60', linewidth=0.8, zorder=2)
                ax.add_patch(rect)
        
        # Vẽ body của nến giảm (bearish - màu đỏ)
        if len(bearish) > 0:
            for idx, row in bearish.iterrows():
                open_price = row['open']
                close_price = row['close']
                body_bottom = min(open_price, close_price)
                body_top = max(open_price, close_price)
                body_height = body_top - body_bottom
                
                # Nếu body quá nhỏ, đặt chiều cao tối thiểu để nhìn thấy
                if body_height < (body_top * 0.001):  # Nếu nhỏ hơn 0.1% giá
                    body_height = body_top * 0.001
                    body_bottom = body_top - body_height
                
                x_pos = mdates.date2num(idx)
                # Vẽ body
                rect = plt.Rectangle((x_pos - width_days/2, body_bottom),
                                    width_days, body_height,
                                    facecolor='#e74c3c', edgecolor='#c0392b', linewidth=0.8, zorder=2)
                ax.add_patch(rect)
        
        # Thêm legend cho nến
        legend_elements = [
            Rectangle((0, 0), 1, 1, facecolor='#2ecc71', edgecolor='#27ae60', label='Nến tăng (Bullish)'),
            Rectangle((0, 0), 1, 1, facecolor='#e74c3c', edgecolor='#c0392b', label='Nến giảm (Bearish)')
        ]
        return legend_elements
    
    # Vẽ candlestick
    candlestick_legend = plot_candlestick(ax1, df)
    
    # Vẽ Tenkan-sen (Conversion Line)
    if 'tenkan_sen' in df.columns:
        ax1.plot(df.index, df['tenkan_sen'], label='Tenkan-sen', color='blue', linewidth=1.5, alpha=0.7)
    
    # Vẽ Kijun-sen (Base Line)
    if 'kijun_sen' in df.columns:
        ax1.plot(df.index, df['kijun_sen'], label='Kijun-sen', color='red', linewidth=1.5, alpha=0.7)
    
    # Vẽ Senkou Span A và B (Cloud)
    if 'senkou_span_a' in df.columns and 'senkou_span_b' in df.columns:
        # Vẽ cloud (kumo)
        ax1.fill_between(df.index, 
                         df['senkou_span_a'], 
                         df['senkou_span_b'],
                         where=(df['senkou_span_a'] >= df['senkou_span_b']),
                         alpha=0.3, color='green', label='Cloud (Bullish)')
        ax1.fill_between(df.index, 
                         df['senkou_span_a'], 
                         df['senkou_span_b'],
                         where=(df['senkou_span_a'] < df['senkou_span_b']),
                         alpha=0.3, color='red', label='Cloud (Bearish)')
        
        # Vẽ đường viền cloud
        ax1.plot(df.index, df['senkou_span_a'], color='green', linewidth=1, alpha=0.5, linestyle='--')
        ax1.plot(df.index, df['senkou_span_b'], color='red', linewidth=1, alpha=0.5, linestyle='--')
    
    # Vẽ Chikou Span (Lagging Span)
    if 'chikou_span' in df.columns:
        ax1.plot(df.index, df['chikou_span'], label='Chikou-span', color='purple', linewidth=1, alpha=0.6)
    
    # Vẽ Buy Signals
    if signals_df is not None:
        buy_signals = signals_df[signals_df['buy_signal'] == True]
        if len(buy_signals) > 0:
            # Lọc theo cùng khoảng thời gian
            buy_signals = buy_signals[buy_signals.index.isin(df.index)]
            if len(buy_signals) > 0:
                ax1.scatter(buy_signals.index, buy_signals['close'], 
                           color='green', marker='^', s=150, zorder=5, 
                           label='Buy Signal', edgecolors='darkgreen', linewidths=2)
    
    # Vẽ Sell Signals
    if signals_df is not None:
        sell_signals = signals_df[signals_df['sell_signal'] == True]
        if len(sell_signals) > 0:
            # Lọc theo cùng khoảng thời gian
            sell_signals = sell_signals[sell_signals.index.isin(df.index)]
            if len(sell_signals) > 0:
                ax1.scatter(sell_signals.index, sell_signals['close'], 
                           color='red', marker='v', s=150, zorder=5, 
                           label='Sell Signal', edgecolors='darkred', linewidths=2)
    
    # Nếu không có signals_df, thử tìm signals trong chính df
    if signals_df is None:
        if 'buy_signal' in df.columns:
            buy_signals = df[df['buy_signal'] == True]
            if len(buy_signals) > 0:
                ax1.scatter(buy_signals.index, buy_signals['close'], 
                           color='green', marker='^', s=150, zorder=5, 
                           label='Buy Signal', edgecolors='darkgreen', linewidths=2)
        
        if 'sell_signal' in df.columns:
            sell_signals = df[df['sell_signal'] == True]
            if len(sell_signals) > 0:
                ax1.scatter(sell_signals.index, sell_signals['close'], 
                           color='red', marker='v', s=150, zorder=5, 
                           label='Sell Signal', edgecolors='darkred', linewidths=2)
    
    ax1.set_ylabel('Giá (USDT)', fontsize=12)
    
    # Thêm legend - bao gồm cả candlestick và các chỉ số Ichimoku
    handles, labels = ax1.get_legend_handles_labels()
    if candlestick_legend:
        # Thêm candlestick legend vào đầu
        handles = candlestick_legend + handles
    ax1.legend(handles=handles, loc='best', fontsize=9)
    ax1.grid(True, alpha=0.3)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
    ax1.xaxis.set_major_locator(mdates.HourLocator(interval=max(1, len(df)//50)))
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Subplot 2: Volume
    ax2.bar(df.index, df['volume'], alpha=0.6, color='blue', label='Volume')
    ax2.set_ylabel('Volume', fontsize=12)
    ax2.set_xlabel('Thời gian', fontsize=12)
    ax2.legend(loc='best', fontsize=10)
    ax2.grid(True, alpha=0.3)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
    ax2.xaxis.set_major_locator(mdates.HourLocator(interval=max(1, len(df)//50)))
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    plt.tight_layout()
    
    # Thêm cursor để hiển thị giá trị khi di chuột (nếu interactive)
    if interactive:
        # Kích hoạt zoom và pan tools - cho phép người dùng tương tác
        # Navigation toolbar sẽ tự động có sẵn khi hiển thị figure
        
        # Thêm cursor crosshair để dễ theo dõi giá trị
        try:
            cursor1 = Cursor(ax1, useblit=True, color='red', linewidth=1, alpha=0.5)
            cursor2 = Cursor(ax2, useblit=True, color='red', linewidth=1, alpha=0.5)
        except:
            # Nếu cursor không hoạt động, bỏ qua
            pass
        
        # Thêm tooltip để hiển thị thông tin chi tiết khi hover
        annot1 = ax1.annotate('', xy=(0,0), xytext=(20,20), textcoords="offset points",
                             bbox=dict(boxstyle="round", fc="w", alpha=0.8),
                             arrowprops=dict(arrowstyle="->"))
        annot1.set_visible(False)
        
        annot2 = ax2.annotate('', xy=(0,0), xytext=(20,20), textcoords="offset points",
                             bbox=dict(boxstyle="round", fc="w", alpha=0.8),
                             arrowprops=dict(arrowstyle="->"))
        annot2.set_visible(False)
        
        def update_annot(ax, annot, idx, val):
            """Cập nhật annotation với thông tin tại điểm được chọn"""
            if idx < len(df):
                row = df.iloc[idx]
                x_pos = df.index[idx]
                text = f"Thời gian: {x_pos.strftime('%Y-%m-%d %H:%M')}\n"
                # Hiển thị OHLC nếu có
                if 'open' in row and pd.notna(row['open']):
                    text += f"Open: ${row['open']:.2f}\n"
                if 'high' in row and pd.notna(row['high']):
                    text += f"High: ${row['high']:.2f}\n"
                if 'low' in row and pd.notna(row['low']):
                    text += f"Low: ${row['low']:.2f}\n"
                text += f"Close: ${val:.2f}\n"
                # Hiển thị các chỉ số Ichimoku nếu có
                if 'tenkan_sen' in row and pd.notna(row['tenkan_sen']):
                    text += f"Tenkan: ${row['tenkan_sen']:.2f}\n"
                if 'kijun_sen' in row and pd.notna(row['kijun_sen']):
                    text += f"Kijun: ${row['kijun_sen']:.2f}"
                annot.xy = (mdates.date2num(x_pos), val)
                annot.set_text(text)
                annot.set_visible(True)
                fig.canvas.draw_idle()
        
        def on_hover(event):
            """Xử lý sự kiện hover để hiển thị tooltip"""
            try:
                if event.inaxes == ax1 and event.xdata is not None:
                    # Tìm điểm gần nhất
                    try:
                        xdata = mdates.num2date(event.xdata)
                        idx = df.index.get_indexer([xdata], method='nearest')[0]
                        if 0 <= idx < len(df):
                            update_annot(ax1, annot1, idx, df.iloc[idx]['close'])
                        else:
                            annot1.set_visible(False)
                            fig.canvas.draw_idle()
                    except (ValueError, OverflowError):
                        annot1.set_visible(False)
                        fig.canvas.draw_idle()
                elif event.inaxes == ax2 and event.xdata is not None:
                    # Tìm điểm gần nhất
                    try:
                        xdata = mdates.num2date(event.xdata)
                        idx = df.index.get_indexer([xdata], method='nearest')[0]
                        if 0 <= idx < len(df):
                            update_annot(ax2, annot2, idx, df.iloc[idx]['volume'])
                        else:
                            annot2.set_visible(False)
                            fig.canvas.draw_idle()
                    except (ValueError, OverflowError):
                        annot2.set_visible(False)
                        fig.canvas.draw_idle()
                else:
                    annot1.set_visible(False)
                    annot2.set_visible(False)
                    fig.canvas.draw_idle()
            except Exception:
                # Bỏ qua lỗi không mong muốn
                pass
        
        fig.canvas.mpl_connect("motion_notify_event", on_hover)
    
    return fig

def main():
    """
    Hàm chính để chạy visualization
    """
    # Đường dẫn file - chỉ cần 1 file duy nhất chứa tất cả dữ liệu
    data_file = 'BTCUSDT_5m_ichimoku_signals.csv'
    
    print("Đang đọc dữ liệu từ file CSV...")
    df = load_ichimoku_data(data_file)
    
    if df is None:
        print("Lỗi: Không thể đọc dữ liệu. Vui lòng kiểm tra file.")
        return
    
    print(f"✓ Đã đọc {len(df)} dòng dữ liệu")
    print(f"✓ Khoảng thời gian: {df.index[0]} đến {df.index[-1]}")
    
    # Đếm số lượng signals nếu có
    if 'buy_signal' in df.columns:
        buy_count = df['buy_signal'].sum()
        print(f"✓ Số lượng Buy Signals: {buy_count}")
    if 'sell_signal' in df.columns:
        sell_count = df['sell_signal'].sum()
        print(f"✓ Số lượng Sell Signals: {sell_count}")
    
    # Vẽ biểu đồ với interactive mode
    # Có thể chỉnh start_date và end_date để zoom vào khoảng thời gian cụ thể
    # Ví dụ: start_date='2024-04-07', end_date='2024-04-08'
    print("\nĐang vẽ biểu đồ...")
    print("Hướng dẫn sử dụng:")
    print("  - Sử dụng thanh công cụ phía trên để:")
    print("    • Phóng to: Click vào biểu tượng kính lúp hoặc scroll wheel")
    print("    • Cuộn/Di chuyển: Click vào biểu tượng mũi tên hoặc kéo chuột")
    print("    • Thu nhỏ: Click vào biểu tượng home hoặc double-click")
    print("    • Reset view: Click vào biểu tượng home")
    print("  - Hoặc sử dụng phím tắt:")
    print("    • Scroll wheel: Zoom in/out")
    print("    • Giữ phím Space + kéo chuột: Pan (di chuyển)")
    print("    • Double-click: Reset zoom\n")
    
    # Truyền df vào cả 2 tham số vì file đã chứa cả signals
    fig = plot_ichimoku(df, signals_df=df, start_date=None, end_date=None, interactive=True)
    
    # Hiển thị biểu đồ interactive trước
    print("\nBiểu đồ đang hiển thị. Đóng cửa sổ để kết thúc hoặc lưu biểu đồ.")
    print("Bạn có thể lưu biểu đồ từ thanh công cụ (biểu tượng disk) hoặc đợi script tự động lưu.\n")
    
    # Hiển thị biểu đồ - block=True để giữ cửa sổ mở
    plt.show(block=True)
    
    # Lưu biểu đồ sau khi đóng cửa sổ (nếu người dùng chưa lưu)
    print("\nĐang lưu biểu đồ...")
    output_file = f'ichimoku_chart_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
    # Tạo bản copy để lưu (có thể giới hạn dữ liệu)
    fig_save = plot_ichimoku(df, signals_df=df, start_date=None, end_date=None, interactive=False)
    plt.figure(fig_save.number)
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close(fig_save)
    print(f"Đã lưu biểu đồ vào: {output_file}")
    
    print("\nHoàn thành!")

if __name__ == "__main__":
    main()

