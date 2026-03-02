/**
 * ========================================
 * 股票仪表盘 HTML 生成器 v3.1
 * ========================================
 * 
 * 功能：将 Excel 数据转换为交互式 HTML 仪表盘
 * 特性：左侧表格 + 右侧 K 线图（使用本地历史数据）
 * 
 * 作者：姐姐
 * 日期：2026-03-03
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ========================================
// 📋 配置区域
// ========================================
const CONFIG = {
    hiddenColumns: ['排名', '必须条件', 'PE', 'PB', 'MA5', 'MA10', 'MA 差%', 'RSI6', '量比', '日线金叉', '当日收红', 'RSI<70', '量比>1', '涨幅<5%', '14 日>-7%', '20 日>-10%', 'MA20 向上', '周线金叉', '3 月>3%'],
    symbols: { check: '✓', cross: '✗', checkColor: '#16a34a', crossColor: '#dc2626' },
    table: { maxHeight: '70vh', rowHeight: '40px', headerBg: '#f8fafc', rowHoverBg: '#f1f5f9', borderColor: '#e2e8f0' },
    filter: { industryColumn: '行业', placeholder: '选择行业...' },
    numberColumns: ['市值 (亿)', '收盘价', '涨幅%', '得分'],
    highlightColumns: ['股票名称', '得分'],
    dataPath: path.join(__dirname, '..', '..', 'data', 'merged'),
    conditionColumns: ['日线金叉', '当日收红', 'RSI<70', '量比>1', '涨幅<5%', '14 日>-7%', '20 日>-10%', 'MA20 向上', '周线金叉', '3 月>3%']
};

// ========================================
// 📖 数据读取函数
// ========================================

function readExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
}

function filterColumns(data, hiddenColumns) {
    if (data.length === 0) return [];
    const allColumns = Object.keys(data[0]);
    const visibleColumns = allColumns.filter(col => !hiddenColumns.includes(col));
    return data.map(row => {
        const newRow = {};
        visibleColumns.forEach(col => { newRow[col] = row[col]; });
        return newRow;
    });
}

function formatCell(value, columnName, config) {
    if (value === '-' || value === 'N/A' || value === null || value === undefined) {
        return { type: 'text', value: value || '-', style: '' };
    }
    if (value === '✓') return { type: 'symbol', value: config.symbols.check, style: `color: ${config.symbols.checkColor}; font-weight: bold;` };
    if (value === '✗') return { type: 'symbol', value: config.symbols.cross, style: `color: ${config.symbols.crossColor}; font-weight: bold;` };
    if (config.numberColumns.includes(columnName) && typeof value === 'number') {
        if (columnName === '市值 (亿)') return { type: 'number', value: (value / 100).toFixed(2), style: '' };
        return { type: 'number', value: value.toFixed(2), style: '' };
    }
    if (config.highlightColumns.includes(columnName)) return { type: 'text', value: value, style: 'font-weight: bold;' };
    return { type: 'text', value: value, style: '' };
}

function generateConditionColumn(row, config) {
    const failedConditions = [];
    const conditionNames = {
        '日线金叉': '日线金叉',
        '当日收红': '当日收红',
        'RSI<70': 'RSI<70',
        '量比>1': '量比>1',
        '涨幅<5%': '涨幅<5%',
        '14 日>-7%': '14 日>-7%',
        '20 日>-10%': '20 日>-10%',
        'MA20 向上': 'MA20 向上',
        '周线金叉': '周线金叉',
        '3 月>3%': '3 月>3%'
    };
    
    config.conditionColumns.forEach(col => {
        if (row[col] === '✗') {
            failedConditions.push(conditionNames[col] || col);
        }
    });
    
    return failedConditions.length > 0 ? failedConditions.join(';') : '-';
}

// ========================================
// 📊 历史数据读取
// ========================================

let historicalDataCache = null;

function loadHistoricalData() {
    if (historicalDataCache) return historicalDataCache;
    
    const historicalData = {};
    
    ['sh_main.csv', 'sz_main.csv'].forEach(file => {
        const filePath = path.join(CONFIG.dataPath, file);
        if (!fs.existsSync(filePath)) return;
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const tsCodeIdx = headers.indexOf('ts_code');
        const tradeDateIdx = headers.indexOf('trade_date');
        const openIdx = headers.indexOf('open');
        const closeIdx = headers.indexOf('close');
        const highIdx = headers.indexOf('high');
        const lowIdx = headers.indexOf('low');
        const volIdx = headers.indexOf('vol');
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const tsCode = values[tsCodeIdx];
            
            if (!historicalData[tsCode]) {
                historicalData[tsCode] = [];
            }
            
            historicalData[tsCode].push({
                date: values[tradeDateIdx],
                open: parseFloat(values[openIdx]) || 0,
                close: parseFloat(values[closeIdx]) || 0,
                high: parseFloat(values[highIdx]) || 0,
                low: parseFloat(values[lowIdx]) || 0,
                vol: parseFloat(values[volIdx]) || 0
            });
        }
    });
    
    Object.keys(historicalData).forEach(tsCode => {
        historicalData[tsCode].sort((a, b) => a.date.localeCompare(b.date));
    });
    
    historicalDataCache = historicalData;
    return historicalData;
}

function getKlineData(stockCode, period) {
    const historicalData = loadHistoricalData();
    let data = historicalData[stockCode];
    
    if (!data || data.length === 0) return null;
    
    data = data.slice(-200);
    
    if (period === 'day') return processDaily(data);
    if (period === 'week') return processWeekly(data);
    if (period === 'month') return processMonthly(data);
    
    return null;
}

function processDaily(data) {
    const dates = data.map(d => d.date);
    // ECharts candlestick 数据格式：[open, close, high, low]
    const kline = data.map(d => [d.open.toFixed(2), d.close.toFixed(2), d.high.toFixed(2), d.low.toFixed(2)]);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.vol);
    
    return { dates, kline, ma5: calculateMA(closes, 5), ma10: calculateMA(closes, 10), volumes };
}

function processWeekly(data) {
    const weekly = [];
    let weekData = [];
    let currentWeek = '';
    
    for (let i = 0; i < data.length; i++) {
        const dateStr = data[i].date;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month, day);
        
        const d = new Date(Date.UTC(year, month, day));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const weekKey = d.getUTCFullYear() + '-W' + weekNo;
        
        if (weekKey !== currentWeek) {
            if (weekData.length > 0) {
                weekly.push({
                    date: weekData[weekData.length - 1].date,
                    open: weekData[0].open,
                    close: weekData[weekData.length - 1].close,
                    high: Math.max(...weekData.map(d => d.high)),
                    low: Math.min(...weekData.map(d => d.low)),
                    vol: weekData.reduce((sum, d) => sum + d.vol, 0)
                });
            }
            weekData = [];
            currentWeek = weekKey;
        }
        weekData.push(data[i]);
    }
    
    if (weekData.length > 0) {
        weekly.push({
            date: weekData[weekData.length - 1].date,
            open: weekData[0].open,
            close: weekData[weekData.length - 1].close,
            high: Math.max(...weekData.map(d => d.high)),
            low: Math.min(...weekData.map(d => d.low)),
            vol: weekData.reduce((sum, d) => sum + d.vol, 0)
        });
    }
    
    const dates = weekly.map(d => d.date);
    const kline = weekly.map(d => [d.open.toFixed(2), d.close.toFixed(2), d.high.toFixed(2), d.low.toFixed(2)]);
    const closes = weekly.map(d => d.close);
    const volumes = weekly.map(d => d.vol);
    
    return { dates, kline, ma5: calculateMA(closes, 5), ma10: calculateMA(closes, 10), volumes };
}

function processMonthly(data) {
    const monthly = [];
    let monthData = [];
    let currentMonth = '';
    
    for (let i = 0; i < data.length; i++) {
        const dateStr = data[i].date;
        const month = dateStr.substring(0, 6);
        
        if (month !== currentMonth) {
            if (monthData.length > 0) {
                monthly.push({
                    date: monthData[monthData.length - 1].date,
                    open: monthData[0].open,
                    close: monthData[monthData.length - 1].close,
                    high: Math.max(...monthData.map(d => d.high)),
                    low: Math.min(...monthData.map(d => d.low)),
                    vol: monthData.reduce((sum, d) => sum + d.vol, 0)
                });
            }
            monthData = [];
            currentMonth = month;
        }
        monthData.push(data[i]);
    }
    
    if (monthData.length > 0) {
        monthly.push({
            date: monthData[monthData.length - 1].date,
            open: monthData[0].open,
            close: monthData[monthData.length - 1].close,
            high: Math.max(...monthData.map(d => d.high)),
            low: Math.min(...monthData.map(d => d.low)),
            vol: monthData.reduce((sum, d) => sum + d.vol, 0)
        });
    }
    
    const dates = monthly.map(d => d.date);
    const kline = monthly.map(d => [d.open.toFixed(2), d.close.toFixed(2), d.high.toFixed(2), d.low.toFixed(2)]);
    const closes = monthly.map(d => d.close);
    const volumes = monthly.map(d => d.vol);
    
    return { dates, kline, ma5: calculateMA(closes, 5), ma10: calculateMA(closes, 10), volumes };
}

function calculateMA(closes, period) {
    const ma = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            ma.push(null);
            continue;
        }
        const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(sum / period);
    }
    return ma;
}

// ========================================
// 🎨 HTML 生成
// ========================================

function generateHTML(data, columns, industries, industryScore10Count, industriesWithoutStocks) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小斐智能选股 1.0.0</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 48px; text-align: center; }
        .header h1 { font-size: 32px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .main-content { display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 80vh; }
        .table-section { border-right: 1px solid ${CONFIG.table.borderColor}; overflow: hidden; }
        .chart-section { display: flex; flex-direction: column; background: #fafbfc; }
        .chart-header { padding: 20px 24px; background: white; border-bottom: 1px solid ${CONFIG.table.borderColor}; display: flex; justify-content: space-between; align-items: center; }
        .chart-title { font-size: 18px; font-weight: 600; color: #1e293b; }
        .chart-controls { display: flex; gap: 8px; }
        .chart-btn { padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; color: #64748b; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .chart-btn:hover { border-color: #667eea; color: #667eea; }
        .chart-btn.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-color: transparent; }
        #klineChart { flex: 1; min-height: 650px; }
        .filter-section { padding: 20px 24px; background: #f8fafc; border-bottom: 1px solid ${CONFIG.table.borderColor}; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .filter-label { font-weight: 600; color: #475569; white-space: nowrap; }
        .filter-select { width: 100%; max-width: 300px; padding: 10px 14px; border: 1px solid ${CONFIG.table.borderColor}; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; transition: all 0.2s; }
        .filter-select:hover { border-color: #667eea; }
        .filter-select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        .filter-btn { padding: 10px 20px; border: none; border-radius: 6px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; white-space: nowrap; }
        .filter-btn:hover { background: linear-gradient(135deg, #15803d 0%, #14532d 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); }
        .filter-btn.active { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); }
        .table-container { max-height: ${CONFIG.table.maxHeight}; overflow: auto; scroll-behavior: smooth; }
        .table-container::-webkit-scrollbar { width: 8px; height: 8px; }
        .table-container::-webkit-scrollbar-track { background: #f1f5f9; }
        .table-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .table-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        table { width: 100%; border-collapse: collapse; font-size: 15.6px; }
        thead { position: sticky; top: 0; z-index: 10; background: ${CONFIG.table.headerBg}; }
        th { padding: 12px 16px; text-align: center; font-weight: 600; color: #475569; border-bottom: 2px solid ${CONFIG.table.borderColor}; white-space: nowrap; }
        td { padding: 10px 16px; border-bottom: 1px solid ${CONFIG.table.borderColor}; color: #334155; white-space: nowrap; text-align: center; }
        tbody tr:hover { background: ${CONFIG.table.rowHoverBg}; }
        tbody tr.score-10 { background: #dcfce7; }
        .footer { padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px; background: #f8fafc; border-top: 1px solid ${CONFIG.table.borderColor}; margin-top: 20px; border-radius: 12px; }
        @media (max-width: 1400px) { .main-content { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><img src="logo.png" style="width: 60px; height: 60px; vertical-align: middle; margin-right: 12px; border-radius: 50%; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="logo"> 小斐智能选股 1.0.0</h1>
            <p>author: 健铭</p>
        </div>
        
        <div class="main-content">
            <div class="table-section">
                <div class="filter-section">
                    <div class="filter-label">🏭 行业筛选</div>
                    <select class="filter-select" id="industryFilter" onchange="filterTable()">
                        <option value="">${CONFIG.filter.placeholder}</option>
                        ${industries.map(i => `<option value="${i}">${i} (${industryScore10Count[i] || 0})</option>`).join('')}
                    </select>
                    <button class="filter-btn" id="score10Btn" onclick="toggleScore10Filter()">⭐ 只看 10 分</button>
                </div>
                
                <div class="table-container" id="tableContainer">
                    <table id="dataTable">
                        <thead><tr>${columns.map(col => `<th>${col === '条件' ? '不符条件' : col}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${data.map(row => {
                                const score = row['得分'];
                                const rowClass = score == 10 ? 'score-10' : '';
                                return `<tr class="${rowClass}" onclick="loadChart('${row['股票代码']}', '${row['股票名称']}', 'day')">
                                    ${columns.map(col => {
                                        const cell = formatCell(row[col], col, CONFIG);
                                        const style = col === '条件' ? 'color: #64748b; font-size: 13px;' : cell.style;
                                        return `<td style="${style}">${cell.value}</td>`;
                                    }).join('')}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="chart-section">
                <div class="chart-header">
                    <div class="chart-title">📈 <span id="chartStockName">点击股票查看 K 线图</span></div>
                    <div class="chart-controls">
                        <button class="chart-btn active" onclick="switchPeriod('day')">日线</button>
                        <button class="chart-btn" onclick="switchPeriod('month')">月线</button>
                    </div>
                </div>
                <div id="klineChart"></div>
            </div>
        </div>
        
        <div class="footer">生成时间：${new Date().toLocaleString('zh-CN')} | 数据来源：OpenClaw 股票分析系统</div>
    </div>
    
    <script src="https://cdn.staticfile.org/echarts/5.4.3/echarts.min.js"></script>
    <script>
        let chart = null;
        let currentPeriod = 'day';
        let currentStockCode = null;
        
        function initChart() {
            chart = echarts.init(document.getElementById('klineChart'));
            const option = {
                backgroundColor: '#fff',
                tooltip: { 
                    trigger: 'axis', 
                    axisPointer: { type: 'cross' }, 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    borderColor: '#fff', 
                    textStyle: { color: '#fff' },
                    formatter: function(params) {
                        let result = params[0].axisValueLabel + '<br/>';
                        const fmt = (val) => {
                            const num = typeof val === 'string' ? parseFloat(val) : val;
                            return isNaN(num) ? '-' : num.toFixed(2);
                        };
                        
                        const klineParam = params.find(p => p.seriesIndex === 0);
                        const volumeParam = params.find(p => p.seriesIndex === 3);
                        const weekKlineParam = params.find(p => p.seriesIndex === 4);
                        
                        if (klineParam && klineParam.value && Array.isArray(klineParam.value) && klineParam.value.length === 4) {
                            const v = klineParam.value;
                            result += '开：' + fmt(v[0]) + '  收：' + fmt(v[1]) + '  高：' + fmt(v[2]) + '  低：' + fmt(v[3]) + '<br/>';
                        }
                        
                        if (volumeParam) {
                            const vol = typeof volumeParam.value === 'object' ? volumeParam.value.value : volumeParam.value;
                            result += '成交量：' + vol.toLocaleString() + ' 手<br/>';
                        }
                        
                        params.forEach(param => {
                            if (param.seriesIndex === 1 && param.seriesName) {
                                result += param.seriesName + ': ' + (typeof param.value === 'number' ? param.value.toFixed(2) : param.value) + '<br/>';
                            } else if (param.seriesIndex === 2 && param.seriesName) {
                                result += param.seriesName + ': ' + (typeof param.value === 'number' ? param.value.toFixed(2) : param.value) + '<br/>';
                            }
                        });
                        
                        if (weekKlineParam && weekKlineParam.value && Array.isArray(weekKlineParam.value) && weekKlineParam.value.length === 4 && currentPeriod === 'day') {
                            const w = weekKlineParam.value;
                            result += '<br/>周线：开' + fmt(w[0]) + ' 收' + fmt(w[1]) + ' 高' + fmt(w[2]) + ' 低' + fmt(w[3]) + '<br/>';
                        }
                        
                        return result;
                    }
                },
                axisPointer: { link: { xAxisIndex: 'all' }, label: { backgroundColor: '#777' } },
                dataZoom: [{ 
                    type: 'inside', 
                    xAxisIndex: [0, 1, 2], 
                    filterMode: 'filter', 
                    start: 0, 
                    end: 100, 
                    zoomLock: false,
                    zoomOnMouseWheel: false
                }, { 
                    show: true, 
                    xAxisIndex: [0, 1, 2], 
                    type: 'slider', 
                    bottom: 10, 
                    start: 0, 
                    end: 100, 
                    backgroundColor: '#f0f0f0', 
                    dataBackground: { lineStyle: { color: '#667eea' }, areaStyle: { color: '#667eea' } }, 
                    selectedDataBackground: { lineStyle: { color: '#764ba2' }, areaStyle: { color: '#764ba2' } }, 
                    handleStyle: { color: '#667eea' }, 
                    textStyle: { color: '#666' },
                    zoomLock: false
                }],
                xAxis: [{ 
                    type: 'category', 
                    data: [], 
                    scale: true, 
                    boundaryGap: false, 
                    axisLine: { onZero: false }, 
                    splitLine: { show: false }, 
                    min: 'dataMin', 
                    max: 'dataMax' 
                }, { 
                    type: 'category', 
                    gridIndex: 1, 
                    data: [], 
                    axisTick: { show: false }, 
                    axisLine: { show: false }, 
                    axisLabel: { show: false }, 
                    splitLine: { show: false } 
                }, {
                    type: 'category',
                    gridIndex: 2,
                    data: [],
                    scale: true,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    splitLine: { show: false }
                }],
                yAxis: [{ 
                    scale: true, 
                    splitArea: { show: true, areaStyle: { color: ['#f8f8f8', '#fff'] } }, 
                    axisLabel: { color: '#666' } 
                }, { 
                    scale: true, 
                    gridIndex: 1, 
                    splitNumber: 2, 
                    axisLabel: { show: false }, 
                    axisLine: { show: false }, 
                    axisTick: { show: false }, 
                    splitLine: { show: false } 
                }, {
                    scale: true,
                    gridIndex: 2,
                    splitNumber: 3,
                    axisLabel: { show: true, color: '#666' },
                    axisLine: { show: true },
                    axisTick: { show: true },
                    splitLine: { show: true, lineStyle: { color: '#e2e8f0' } }
                }],
                grid: [
                    { left: '10%', right: '10%', top: '5%', height: '45%' },
                    { left: '10%', right: '10%', top: '53%', height: '12%' },
                    { left: '10%', right: '10%', top: '68%', height: '27%' }
                ],
                series: [
                    { name: '日线 K 线', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0, data: [], itemStyle: { color: '#ef4444', color0: '#16a34a', borderColor: '#ef4444', borderColor0: '#16a34a' } },
                    { name: '日线 MA5', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
                    { name: '日线 MA10', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#667eea' } },
                    { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: [], itemStyle: { color: function(params) { return params.data && params.data.color ? params.data.color : '#ef4444'; } }, barMaxWidth: 20 },
                    { name: '周线 K 线', type: 'candlestick', xAxisIndex: 2, yAxisIndex: 2, data: [], itemStyle: { color: '#ef4444', color0: '#16a34a', borderColor: '#ef4444', borderColor0: '#16a34a' } },
                    { name: '周线 MA5', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
                    { name: '周线 MA10', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#667eea' } }
                ]
            };
            chart.setOption(option);
            window.addEventListener('resize', function() { chart.resize(); });
        }
        
        async function loadChart(stockCode, stockName, period) {
            currentStockCode = stockCode;
            currentPeriod = period || 'day';
            document.getElementById('chartStockName').textContent = stockName + ' (' + stockCode + ')';
            if (!chart) initChart();
            
            const mainData = getKlineData(stockCode, currentPeriod);
            const weekData = getKlineData(stockCode, 'week');
            
            if (!mainData) {
                alert('无历史数据');
                return;
            }
            
            const volumeData = mainData.volumes.map((vol, idx) => {
                const kline = mainData.kline[idx];
                const open = parseFloat(kline[0]);
                const close = parseFloat(kline[1]);
                return { value: vol, color: close >= open ? '#ef4444' : '#16a34a' };
            });
            
            const mainName = currentPeriod === 'day' ? '日线' : '月线';
            
            chart.setOption({
                xAxis: [
                    { data: mainData.dates },
                    { data: mainData.dates },
                    { data: weekData ? weekData.dates : [] }
                ],
                series: [
                    { name: mainName + ' K 线', data: mainData.kline },
                    { name: mainName + ' MA5', data: mainData.ma5 },
                    { name: mainName + ' MA10', data: mainData.ma10 },
                    { data: volumeData },
                    { data: weekData ? weekData.kline : [] },
                    { data: weekData ? weekData.ma5 : [] },
                    { data: weekData ? weekData.ma10 : [] }
                ],
                graphic: [
                    { type: 'text', left: '11%', top: '2%', style: { text: mainName, font: 'bold 14px sans-serif', fill: '#667eea' }, silent: true },
                    { type: 'text', left: '11%', top: '54%', style: { text: '成交量', font: 'bold 14px sans-serif', fill: '#667eea' }, silent: true },
                    { type: 'text', left: '11%', top: '69%', style: { text: '周线', font: 'bold 14px sans-serif', fill: '#667eea' }, silent: true }
                ]
            });
        }
        
        function switchPeriod(period) {
            if (!currentStockCode) return;
            currentPeriod = period;
            document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadChart(currentStockCode, null, period);
        }
        
        function filterTable() {
            const industry = document.getElementById('industryFilter').value;
            const rows = document.querySelectorAll('#dataTable tbody tr');
            rows.forEach(row => {
                const stockIndustry = row.cells[1]?.textContent || '';
                row.style.display = !industry || stockIndustry === industry ? '' : 'none';
            });
        }
        
        function toggleScore10Filter() {
            const btn = document.getElementById('score10Btn');
            const rows = document.querySelectorAll('#dataTable tbody tr.score-10');
            btn.classList.toggle('active');
            const isFiltered = btn.classList.contains('active');
            rows.forEach(row => {
                if (isFiltered) {
                    row.dataset.prevDisplay = row.style.display;
                    row.style.display = '';
                } else {
                    row.style.display = row.dataset.prevDisplay || '';
                }
            });
            if (isFiltered) {
                document.querySelectorAll('#dataTable tbody tr:not(.score-10)').forEach(row => {
                    row.dataset.prevDisplay = row.style.display;
                    row.style.display = 'none';
                });
            } else {
                document.querySelectorAll('#dataTable tbody tr:not(.score-10)').forEach(row => {
                    row.style.display = row.dataset.prevDisplay || '';
                });
            }
        }
        
        const tableContainer = document.getElementById('tableContainer');
        tableContainer.addEventListener('wheel', function(e) {
            if (e.deltaY !== 0) {
                this.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        }, { passive: false });
        
        window.historicalData = {};
        
        function getKlineData(stockCode, period) {
            const key = stockCode + '_' + period;
            return window.historicalData[key] || null;
        }
    </script>
</body>
</html>`;
}

// ========================================
// 💾 保存文件
// ========================================

function saveHTML(html, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html, 'utf8');
}

// ========================================
// 🚀 主程序
// ========================================

const inputFile = process.argv[2] || path.join(__dirname, '..', '..', 'output', 'excel', '全股票池分析_行业 Top5.xlsx');
const outputFile = process.argv[3] || path.join(__dirname, '..', '..', 'output', 'dashboard', '小斐智能选股 1.0.html');

console.log('========================================');
console.log('  📊 股票仪表盘 HTML 生成器 v3.1');
console.log('========================================\n');

const data = readExcel(inputFile);
const filteredData = filterColumns(data, CONFIG.hiddenColumns);

const industries = [...new Set(filteredData.map(row => row[CONFIG.filter.industryColumn]).filter(Boolean))];
const industryScore10Count = {};
industries.forEach(ind => {
    industryScore10Count[ind] = filteredData.filter(row => row[CONFIG.filter.industryColumn] === ind && row['得分'] == 10).length;
});

const columns = Object.keys(filteredData[0] || {});

console.log(`📖 读取 Excel: ${inputFile}`);
console.log(`✅ 读取到 ${data.length} 行数据`);
console.log(`📊 原始列数：${columns.length}, 隐藏后：${Object.keys(filteredData[0] || {}).length}`);

console.log('\n📖 加载历史数据...');
loadHistoricalData();

console.log(`📊 为 ${filteredData.length} 只股票生成 K 线数据...`);
const historicalData = loadHistoricalData();
const stockCodes = filteredData.map(row => row['股票代码']);

stockCodes.forEach(stockCode => {
    ['day', 'week', 'month'].forEach(period => {
        const data = getKlineData(stockCode, period);
        if (data) {
            historicalData[stockCode + '_' + period] = data;
        }
    });
});

const html = generateHTML(filteredData, columns, industries, industryScore10Count, []);

const historicalDataStr = JSON.stringify(historicalData).replace(/"open":(\d+)/g, '"open":$1').replace(/"close":(\d+)/g, '"close":$1');
const htmlWithData = html.replace('window.historicalData = {};', `window.historicalData = ${historicalDataStr};`);

saveHTML(htmlWithData, outputFile);

console.log(`💾 HTML 已保存：${outputFile}`);
console.log(`\n⏱️  仪表盘生成完成！`);
console.log('\n========================================');
console.log('  ✅ 仪表盘生成完成！');
console.log('========================================');
