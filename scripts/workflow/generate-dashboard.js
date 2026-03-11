/**
 * ========================================
 * 股票仪表盘 HTML 生成器 v3.2
 * ========================================
 * 
 * 修复内容：
 * 1. 撑满整个页面
 * 2. 行业筛选器括号显示 10 分股数量
 * 3. 左侧表格支持滚轮横向滚动
 * 4. 右侧下方滚动条右端点固定
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CONFIG = {
    // 排除的行业列表（58 个传统行业）
    excludedIndustries: [
        '中成药', '乳制品', '互联网', '仓储物流', '全国地产', '供气供热', '其他建材',
        '出版业', '化学制药', '化纤', '区域地产', '医药商业', '医疗保健', '商品城',
        '商贸代理', '园区开发', '塑料', '家居用品', '广告包装', '影视音像', '摩托车',
        '房产服务', '日用化工', '普钢', '服饰', '机场', '染料涂料', '林业', '水务',
        '汽车服务', '港口', '火力发电', '焦炭加工', '煤炭开采', '特种钢', '环境保护',
        '玻璃', '生物制药', '电信运营', '电器仪表', '电器连锁', '百货', '矿物制品',
        '空运', '红黄酒', '纺织', '纺织机械', '综合类', '装修装饰', '超市连锁', '路桥',
        '轻工机械', '造纸', '钢加工', '铁路', '铅锌', '公路', '公共交通'
    ],
    // 持仓列表（弟弟的自选股，每天都显示在仪表盘）
    holdings: ['601600', '600392', '603993', '000969', '002046', '002270', '601611'],
    hiddenColumns: ['排名', '必须条件', 'PE', 'PB', 'MA5', 'MA10', 'MA 差%', 'RSI6', '收盘价', '日线金叉', '当日收红', 'RSI<70', '量比>1', '涨幅<5%', '14 日>-7%', '20 日>-10%', 'MA20 向上', '周线金叉', '3 月>3%'],
    symbols: { check: '✓', cross: '✗', checkColor: '#16a34a', crossColor: '#dc2626' },
    table: { maxHeight: '75vh', rowHeight: '40px', headerBg: '#f8fafc', rowHoverBg: '#f1f5f9', borderColor: '#e2e8f0' },
    filter: { industryColumn: '行业', placeholder: '选择行业...' },
    numberColumns: ['市值 (亿)', '量比', '涨幅%', '得分'],
    highlightColumns: ['得分'],  // 只加粗得分列
    dataPath: path.join(__dirname, '..', '..', 'data', 'merged'),
    etfDataPath: path.join(__dirname, '..', '..', 'data', 'etf'),
    conditionColumns: ['日线金叉', '当日收红', 'RSI<70', '量比>1', '涨幅<5%', '14 日>-7%', '20 日>-10%', 'MA20 向上', '周线金叉', '3 月>3%']
};

function readExcel(filePath) {
    // 确保使用绝对路径
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    console.log(`📂 读取文件：${absolutePath}`);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`文件不存在：${absolutePath}`);
    }
    
    // 添加 codepage 选项确保正确读取中文（Excel 默认使用 CP936/GBK 编码）
    const workbook = XLSX.readFile(absolutePath, { codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
}

/**
 * 读取 ETF 列表（排除宽基，带数据质量检测）
 */
function readETFList() {
    const etfListPath = path.join(CONFIG.etfDataPath, 'etf_final_list.txt');
    if (!fs.existsSync(etfListPath)) {
        console.log('⚠️  ETF 列表文件不存在，跳过 ETF 整合');
        return [];
    }
    
    console.log('\n🔍 ETF 列表文件质量检测...');
    const content = fs.readFileSync(etfListPath, 'utf8');
    const allLines = content.trim().split('\n');
    const lines = allLines.slice(1); // 跳过表头
    
    // 检测 header
    const header = allLines[0];
    if (!header.includes('代码') || !header.includes('名称')) {
        console.log('⚠️  ETF 列表 header 可能不正确:', header);
    }
    
    // 检测乱码
    let garbledCount = 0;
    lines.slice(0, 20).forEach((line, idx) => {
        if (containsGarbledText(line)) {
            garbledCount++;
            if (garbledCount <= 3) {
                console.log(`   ⚠️  第 ${idx+2} 行检测到乱码：${line.substring(0, 50)}`);
            }
        }
    });
    
    if (garbledCount > 0) {
        console.log(`❌ 发现 ${garbledCount} 行乱码，请检查文件编码`);
        throw new Error('ETF 列表文件包含乱码，请确保使用 UTF-8 编码保存');
    }
    
    console.log('✅ ETF 列表文件质量检查通过');
    
    const etfList = [];
    lines.forEach(line => {
        const [code, name, category] = line.split(',');
        // 只保留非宽基 ETF
        if (category && category.trim() !== '宽基') {
            etfList.push({
                code: code.trim(),
                name: name.trim(),
                category: category.trim()
            });
        }
    });
    
    console.log(`📊 ETF 列表：读取 ${etfList.length} 只非宽基 ETF（已排除宽基）`);
    return etfList;
}

/**
 * 检测字符串是否包含乱码（非 UTF-8 中文字符）
 */
function containsGarbledText(str) {
    // 常见乱码模式：锟斤拷、烫烫烫、以及高字节非中文字符
    const garbledPatterns = [
        /[\uFFFD]/,  // Unicode 替换字符
        /锟斤拷/,
        /烫烫烫/,
        /鐎硅棄鐔/,  // 之前出现的乱码模式
        /瀹藉熀/,    // 宽基的乱码
        /澶/,       // 常见的 UTF-8/GBK 混码字符
    ];
    return garbledPatterns.some(pattern => pattern.test(str));
}

/**
 * 验证 ETF 数据质量
 */
function validateETFData(lines) {
    const report = {
        totalLines: lines.length,
        headerLine: lines[0],
        duplicateHeaders: 0,
        garbledTextFound: false,
        garbledLines: [],
        valid: true
    };
    
    // 检测重复 header
    const headerPattern = lines[0];
    for (let i = 1; i < Math.min(10, lines.length); i++) {
        if (lines[i] === headerPattern) {
            report.duplicateHeaders++;
            report.garbledLines.push(`第 ${i+1} 行：重复的 header`);
        }
    }
    
    // 检测乱码
    for (let i = 1; i < Math.min(100, lines.length); i++) {
        if (containsGarbledText(lines[i])) {
            report.garbledTextFound = true;
            report.garbledLines.push(`第 ${i+1} 行：检测到乱码`);
        }
    }
    
    // 验证结果
    if (report.duplicateHeaders > 0 || report.garbledTextFound) {
        report.valid = false;
    }
    
    return report;
}

/**
 * 读取 ETF 历史数据（带数据质量检测）
 */
function readETFData() {
    const etfDataPath = path.join(CONFIG.etfDataPath, 'etf_merged_full.csv');
    if (!fs.existsSync(etfDataPath)) {
        console.log('⚠️  ETF 数据文件不存在');
        return null;
    }
    
    console.log('\n🔍 ETF 数据质量检测...');
    const content = fs.readFileSync(etfDataPath, 'utf8');
    const lines = content.trim().split('\n');
    
    // 数据质量验证
    const validation = validateETFData(lines);
    
    if (!validation.valid) {
        console.log('❌ ETF 数据文件存在问题：');
        if (validation.duplicateHeaders > 0) {
            console.log(`   - 发现 ${validation.duplicateHeaders} 行重复的 header`);
        }
        if (validation.garbledTextFound) {
            console.log(`   - 发现乱码文本`);
        }
        validation.garbledLines.slice(0, 5).forEach(line => {
            console.log(`   - ${line}`);
        });
        console.log('\n💡 建议：重新生成 ETF 数据文件，确保编码为 UTF-8');
        throw new Error('ETF 数据文件质量不合格，请检查 data/etf/etf_merged_full.csv');
    }
    
    console.log('✅ ETF 数据质量检查通过');
    console.log(`   - 总行数：${validation.totalLines}`);
    console.log(`   - Header: ${validation.headerLine.split(',').length} 列`);
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    const etfData = {};
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const openIdx = headers.indexOf('open');
    const closeIdx = headers.indexOf('close');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const volIdx = headers.indexOf('vol');
    const amountIdx = headers.indexOf('amount');
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        
        if (!etfData[tsCode]) {
            etfData[tsCode] = [];
        }
        
        etfData[tsCode].push({
            date: values[tradeDateIdx],
            open: parseFloat(values[openIdx]) || 0,
            close: parseFloat(values[closeIdx]) || 0,
            high: parseFloat(values[highIdx]) || 0,
            low: parseFloat(values[lowIdx]) || 0,
            vol: parseFloat(values[volIdx]) || 0,
            amount: parseFloat(values[amountIdx]) || 0
        });
    }
    
    // 按日期排序
    Object.keys(etfData).forEach(tsCode => {
        etfData[tsCode].sort((a, b) => a.date.localeCompare(b.date));
    });
    
    return etfData;
}

/**
 * 计算 ETF 评分（类似股票的 10 个指标）
 */
function calculateETFScore(etfCode, etfHistory) {
    if (!etfHistory || etfHistory.length < 20) {
        return { score: 0, details: {} };
    }
    
    const latest = etfHistory[etfHistory.length - 1];
    const prev = etfHistory[etfHistory.length - 2];
    
    // 计算 MA5, MA10, MA20
    const getMA = (period) => {
        if (etfHistory.length < period) return 0;
        const sum = etfHistory.slice(-period).reduce((s, d) => s + d.close, 0);
        return sum / period;
    };
    
    const ma5 = getMA(5);
    const ma10 = getMA(10);
    const ma20 = getMA(20);
    
    // 计算 RSI6
    const calculateRSI = (period) => {
        if (etfHistory.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = etfHistory.length - period; i < etfHistory.length; i++) {
            const change = etfHistory[i].close - etfHistory[i - 1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }
        const rs = losses === 0 ? 100 : gains / losses;
        return 100 - (100 / (1 + rs));
    };
    
    const rsi6 = calculateRSI(6);
    
    // 计算涨幅
    const pctChange = ((latest.close - prev.close) / prev.close) * 100;
    
    // 计算 14 日和 20 日涨幅
    const pct14 = etfHistory.length > 14 ? ((latest.close - etfHistory[etfHistory.length - 14].close) / etfHistory[etfHistory.length - 14].close) * 100 : 0;
    const pct20 = etfHistory.length > 20 ? ((latest.close - etfHistory[etfHistory.length - 20].close) / etfHistory[etfHistory.length - 20].close) * 100 : 0;
    
    // 计算量比（简化版：今日量/过去 5 日平均量）
    const avgVol5 = etfHistory.slice(-5).reduce((s, d) => s + d.vol, 0) / 5;
    const volumeRatio = avgVol5 > 0 ? latest.vol / avgVol5 : 1;
    
    // 10 个评分指标
    let score = 0;
    const details = {};
    
    // 1. 日线金叉 (MA5 > MA10)
    details['日线金叉'] = ma5 > ma10 ? 1 : 0;
    score += details['日线金叉'];
    
    // 2. 当日收红
    details['当日收红'] = latest.close > prev.close ? 1 : 0;
    score += details['当日收红'];
    
    // 3. RSI<70
    details['RSI'] = rsi6 < 70 ? 1 : 0;
    score += details['RSI'];
    
    // 4. 量比>1
    details['量比'] = volumeRatio > 1 ? 1 : 0;
    score += details['量比'];
    
    // 5. 涨幅<5%
    details['涨幅'] = pctChange < 5 ? 1 : 0;
    score += details['涨幅'];
    
    // 6. 14 日>-7%
    details['14 日'] = pct14 > -7 ? 1 : 0;
    score += details['14 日'];
    
    // 7. 20 日>-10%
    details['20 日'] = pct20 > -10 ? 1 : 0;
    score += details['20 日'];
    
    // 8. MA20 向上
    const ma20Prev = getMA(20);
    const ma20Prev2 = etfHistory.length > 20 ? (() => {
        const sum = etfHistory.slice(-21, -1).reduce((s, d) => s + d.close, 0);
        return sum / 20;
    })() : ma20;
    details['MA20 向上'] = ma20 >= ma20Prev2 ? 1 : 0;
    score += details['MA20 向上'];
    
    // 9. 周线金叉（简化：用月线代替）
    const ma5_month = etfHistory.length > 25 ? getMA(25) : ma5;
    const ma10_month = etfHistory.length > 50 ? (() => {
        const sum = etfHistory.slice(-50).reduce((s, d) => s + d.close, 0) / 50;
    })() : ma10;
    details['周线金叉'] = ma5_month > ma10_month ? 1 : 0;
    score += details['周线金叉'];
    
    // 10. 3 月>3%
    const pct3Month = etfHistory.length > 60 ? ((latest.close - etfHistory[etfHistory.length - 60].close) / etfHistory[etfHistory.length - 60].close) * 100 : 0;
    details['3 月'] = pct3Month > 3 ? 1 : 0;
    score += details['3 月'];
    
    return { score, details, latest, pctChange, volumeRatio, rsi6, ma5, ma10, ma20 };
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

/**
 * 根据数值获取颜色深浅
 * @param {number} value - 数值
 * @param {number} threshold - 分界值（0 或 1）
 * @returns {string} - CSS 颜色值
 */
function getColorByValue(value, threshold) {
    const diff = Math.abs(value - threshold);
    // 计算颜色深度（0-1 之间），上限设为 10%（涨幅）或 2（量比）
    const maxDiff = threshold === 0 ? 10 : 2;
    const intensity = Math.min(diff / maxDiff, 1);
    
    if (value > threshold) {
        // 红色系：从浅红到深红
        const r = 220;
        const g = Math.round(38 * (1 - intensity));
        const b = Math.round(38 * (1 - intensity));
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // 绿色系：从浅绿到深绿
        const r = Math.round(38 * (1 - intensity));
        const g = 162;
        const b = Math.round(74 * (1 - intensity));
        return `rgb(${r}, ${g}, ${b})`;
    }
}

function formatCell(value, columnName, config) {
    if (value === '-' || value === 'N/A' || value === null || value === undefined) {
        return { type: 'text', value: value || '-', style: '' };
    }
    if (value === '✓') return { type: 'symbol', value: config.symbols.check, style: `color: ${config.symbols.checkColor}; font-weight: bold;` };
    if (value === '✗') return { type: 'symbol', value: config.symbols.cross, style: `color: ${config.symbols.crossColor}; font-weight: bold;` };
    
    // 处理数字列（支持字符串和数字类型）
    if (config.numberColumns.includes(columnName)) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (typeof numValue === 'number' && !isNaN(numValue)) {
            if (columnName === '市值 (亿)') return { type: 'number', value: Math.round(numValue).toString(), style: '' };  // 显示整数
            if (columnName === '得分') return { type: 'number', value: Math.round(numValue).toString(), style: 'font-weight: bold;' };  // 显示整数，加粗
            
            // 量比：以 1 为分界，添加颜色
            if (columnName === '量比') {
                const color = getColorByValue(numValue, 1);
                return { type: 'number', value: numValue.toFixed(1), style: `color: ${color}; font-weight: 600;` };
            }
            
            // 涨幅：以 0 为分界，添加颜色
            if (columnName === '涨幅%') {
                const color = getColorByValue(numValue, 0);
                return { type: 'number', value: numValue.toFixed(1) + '%', style: `color: ${color}; font-weight: 600;` };
            }
            
            return { type: 'number', value: numValue.toFixed(2), style: '' };
        }
    }
    
    if (config.highlightColumns.includes(columnName)) return { type: 'text', value: value, style: 'font-weight: bold;' };
    return { type: 'text', value: value, style: '' };
}

let historicalDataCache = null;

/**
 * 【优化版】只加载指定股票代码的历史数据
 * 原始版本加载全部 CSV 数据（1383 只股票），优化后只加载 Excel 中的股票（约 154 只）
 */
function loadHistoricalDataForStocks(stockCodes) {
    if (historicalDataCache) return historicalDataCache;
    
    const historicalData = {};
    // 创建两个集合：一个用于匹配带后缀的代码，一个用于匹配不带后缀的代码
    const stockSetWithSuffix = new Set(stockCodes);
    const stockSetWithoutSuffix = new Set(stockCodes.map(code => code.replace('.SZ', '').replace('.SH', '')));
    
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
            const tsCodeWithoutSuffix = tsCode.replace('.SZ', '').replace('.SH', '');
            
            // 【关键优化】只加载 Excel 中需要的股票（支持两种格式匹配）
            if (stockSetWithSuffix.has(tsCode) || stockSetWithoutSuffix.has(tsCodeWithoutSuffix)) {
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
        }
    });
    
    Object.keys(historicalData).forEach(tsCode => {
        historicalData[tsCode].sort((a, b) => a.date.localeCompare(b.date));
    });
    
    historicalDataCache = historicalData;
    return historicalData;
}

function getKlineData(stockCode, period) {
    // 使用已加载的历史数据（不重新加载）
    if (!historicalDataCache) return null;
    
    // 尝试多种格式匹配股票代码
    let data = historicalDataCache[stockCode];
    if (!data) {
        // 尝试带 .SZ 后缀
        data = historicalDataCache[stockCode + '.SZ'];
    }
    if (!data) {
        // 尝试带 .SH 后缀
        data = historicalDataCache[stockCode + '.SH'];
    }
    if (!data) {
        // 尝试从缓存中查找匹配的代码（去掉后缀）
        const codeWithoutSuffix = stockCode.replace('.SZ', '').replace('.SH', '');
        for (const key of Object.keys(historicalDataCache)) {
            if (key.replace('.SZ', '').replace('.SH', '') === codeWithoutSuffix) {
                data = historicalDataCache[key];
                break;
            }
        }
    }
    
    if (!data || data.length === 0) return null;
    
    data = data.slice(-200);
    
    if (period === 'day') return processDaily(data);
    if (period === 'week') return processWeekly(data);
    if (period === 'month') return processMonthly(data);
    
    return null;
}

function processDaily(data) {
    const dates = data.map(d => d.date);
    const kline = data.map(d => [d.open.toFixed(2), d.close.toFixed(2), d.high.toFixed(2), d.low.toFixed(2)]);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.vol);
    const boll = calculateBOLL(closes, 20, 2);
    
    return { dates, kline, ma5: calculateMA(closes, 5), ma10: calculateMA(closes, 10), boll, volumes };
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

function calculateBOLL(closes, period = 20, multiplier = 2) {
    const boll = { middle: [], upper: [], lower: [] };
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            boll.middle.push(null);
            boll.upper.push(null);
            boll.lower.push(null);
            continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const middle = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
        const std = Math.sqrt(variance);
        boll.middle.push(middle);
        boll.upper.push(middle + multiplier * std);
        boll.lower.push(middle - multiplier * std);
    }
    return boll;
}

function generateHTML(data, columns, industries, industryScore10Count, etfCount = 0, holdingsCount = 0, scoreHighCount = 0) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小斐智能选股 1.0.0</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 10px; }
        .container { width: 100%; height: 100%; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; text-align: center; flex-shrink: 0; }
        .header h1 { font-size: 24px; margin-bottom: 4px; }
        .header p { opacity: 0.9; font-size: 12px; }
        .main-content { display: flex; flex: 1; overflow: hidden; }
        .table-section { width: 50%; border-right: 1px solid ${CONFIG.table.borderColor}; overflow: hidden; display: flex; flex-direction: column; }
        .chart-section { width: 50%; display: flex; flex-direction: column; background: #fafbfc; overflow: hidden; }
        .chart-header { padding: 12px 20px; background: white; border-bottom: 1px solid ${CONFIG.table.borderColor}; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .chart-title { font-size: 16px; font-weight: 600; color: #1e293b; }
        .chart-controls { display: flex; gap: 8px; }
        .chart-btn { padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 4px; background: white; color: #64748b; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .chart-btn:hover { border-color: #667eea; color: #667eea; }
        .chart-btn.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-color: transparent; }
        #klineChart { flex: 1; min-height: 0; }
        .filter-section { padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid ${CONFIG.table.borderColor}; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex-shrink: 0; min-height: 60px; }
        .filter-label { font-weight: 600; color: #475569; white-space: nowrap; font-size: 14px; }
        .filter-select { width: 100%; max-width: 200px; padding: 8px 12px; border: 1px solid ${CONFIG.table.borderColor}; border-radius: 4px; font-size: 13px; background: white; cursor: pointer; transition: all 0.2s; }
        .filter-select:hover { border-color: #667eea; }
        .filter-select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1); }
        .search-input { width: 100%; max-width: 200px; padding: 8px 12px; border: 1px solid ${CONFIG.table.borderColor}; border-radius: 4px; font-size: 13px; background: white; transition: all 0.2s; }
        .search-input:hover { border-color: #667eea; }
        .search-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1); }
        .filter-btn { padding: 8px 16px; border: none; border-radius: 4px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; white-space: nowrap; }
        .filter-btn:hover { background: linear-gradient(135deg, #15803d 0%, #14532d 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); }
        .filter-btn.active { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); }
        .filter-btn.etf { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .filter-btn.etf:hover { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); }
        .filter-btn.etf.active { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); }
        .filter-btn.etf.active:hover { background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); }
        .table-container { flex: 1; overflow: auto; }
        .table-container::-webkit-scrollbar { width: 8px; height: 8px; }
        .table-container::-webkit-scrollbar-track { background: #f1f5f9; }
        .table-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .table-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        table { width: 100%; border-collapse: collapse; font-size: 17px; min-width: 900px; }
        thead { position: sticky; top: 0; z-index: 10; background: ${CONFIG.table.headerBg}; }
        th { padding: 16px 18px; text-align: center; font-weight: 600; color: #475569; border-bottom: 2px solid ${CONFIG.table.borderColor}; white-space: nowrap; font-size: 17px; }
        td { padding: 14px 18px; border-bottom: 1px solid ${CONFIG.table.borderColor}; color: #334155; white-space: nowrap; text-align: center; font-size: 17px; }
        tbody tr:hover { background: ${CONFIG.table.rowHoverBg}; }
        tbody tr.score-high { background: #dcfce7; }
        tbody tr.holding { background: #dbeafe; }
        tbody tr.holding.score-high { background: #bbf7d0; }
        tbody tr.etf { background: #f3e8ff; }
        tbody tr.etf.score-high { background: #e9d5ff; }
        .footer { padding: 10px 24px; text-align: center; color: #64748b; font-size: 11px; background: #f8fafc; border-top: 1px solid ${CONFIG.table.borderColor}; flex-shrink: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><img src="logo.png" style="width: 40px; height: 40px; vertical-align: middle; margin-right: 10px; border-radius: 50%; object-fit: cover;" alt="logo"> 小斐智能选股 1.0.0</h1>
            <p>author: 健铭 | 交易日：${formattedTradeDate}</p>
        </div>
        
        <div class="main-content">
            <div class="table-section">
                <div class="filter-section">
                    <div class="filter-label">🏭 行业筛选</div>
                    <select class="filter-select" id="industryFilter" onchange="filterTable()">
                        <option value="">${CONFIG.filter.placeholder}</option>
                        ${industries.map(i => `<option value="${i}">${i} (${industryTotalCount[i] || 0})</option>`).join('')}
                    </select>
                    <input type="text" class="search-input" id="stockSearch" placeholder="搜索股票名称或代码..." oninput="filterTable()" />
                    <button class="filter-btn" id="holdingsBtn" onclick="toggleHoldingsFilter()">💼 只看持仓 (${holdingsCount})</button>
                    <button class="filter-btn" id="scoreHighBtn" onclick="toggleScoreHighFilter()">⭐ 只看 9-10 分 (${scoreHighCount})</button>
                    ${etfCount > 0 ? `<button class="filter-btn etf" id="etfBtn" onclick="toggleETFFilter()">📈 只看 ETF (${etfCount})</button>` : ''}
                </div>
                
                <div class="table-container" id="tableContainer">
                    <table id="dataTable">
                        <thead><tr>${columns.map(col => `<th>${col === '条件' ? '不符条件' : (col === '涨幅%' ? '涨幅' : col)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${data.map(row => {
                                const score = row['得分'];
                                let stockCode = row['股票代码'];
                                const stockName = row['股票名称'];
                                
                                // 判断是否为持仓股票（支持带后缀和不带后缀的匹配）
                                const stockCodeNoSuffix = stockCode?.replace('.SZ', '').replace('.SH', '');
                                const isHolding = CONFIG.holdings.includes(stockCodeNoSuffix);
                                
                                // 为持仓股票添加后缀（用于 K 线图加载）
                                let tsCodeForChart = stockCode;
                                if (isHolding && !stockCode.includes('.')) {
                                    if (stockCode.startsWith('6')) {
                                        tsCodeForChart = stockCode + '.SH';
                                    } else {
                                        tsCodeForChart = stockCode + '.SZ';
                                    }
                                }
                                
                                // 显示时带后缀
                                const displayStockCode = tsCodeForChart;
                                
                                // 判断是否为 ETF
                                const isETF = row['_isETF'] === true;
                                
                                // 获取涨幅（用于排序）
                                const pctChange = row['_pctChange'] !== undefined ? row['_pctChange'] : 0;
                                
                                // 构建行 class
                                let rowClass = '';
                                if (isETF) {
                                    // ETF 按分数高亮（恢复）
                                    rowClass = 'etf' + ((score == 9 || score == 10) ? ' score-high' : '');
                                } else {
                                    rowClass = (score == 9 || score == 10) ? 'score-high' + (isHolding ? ' holding' : '') : (isHolding ? 'holding' : '');
                                }
                                
                                return `<tr class="${rowClass}" data-pct-change="${pctChange}" onclick="loadChart('${tsCodeForChart}', '${stockName}', 'day')">
                                    ${columns.map(col => {
                                        const cell = formatCell(row[col], col, CONFIG);
                                        let displayValue = cell.value;
                                        // 股票代码列显示带后缀
                                        if (col === '股票代码') {
                                            displayValue = displayStockCode;
                                        }
                                        const style = col === '条件' ? 'color: #64748b; font-size: 12px;' : cell.style;
                                        return `<td style="${style}">${displayValue}</td>`;
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
        let currentStockName = null;
        
        // 保持最新数据点固定在右侧
        function keepRightEndFixed() {
            if (!chart) return;
            const option = chart.getOption();
            const dataZoom = option.dataZoom[0];
            if (dataZoom) {
                chart.setOption({
                    dataZoom: [{
                        end: 100
                    }]
                });
            }
        }
        
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
                    zoomOnMouseWheel: true,
                    moveOnMouseMove: false,
                    moveOnMouseWheel: false
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
                    { left: '8%', right: '8%', top: '5%', height: '50%' },
                    { left: '8%', right: '8%', top: '58%', height: '12%' },
                    { left: '8%', right: '8%', top: '73%', height: '22%' }
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
            currentStockName = stockName || currentStockName;  // 如果为 null，使用已保存的名称
            currentPeriod = period || 'day';
            document.getElementById('chartStockName').textContent = currentStockName + ' (' + currentStockCode + ')';
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
            
            // 布林线数据（只在日线图显示）
            const bollUpper = currentPeriod === 'day' && mainData.boll ? mainData.boll.upper : [];
            const bollMiddle = currentPeriod === 'day' && mainData.boll ? mainData.boll.middle : [];
            const bollLower = currentPeriod === 'day' && mainData.boll ? mainData.boll.lower : [];
            
            chart.setOption({
                xAxis: [
                    { data: mainData.dates },
                    { data: mainData.dates },
                    { data: weekData ? weekData.dates : [] }
                ],
                series: [
                    { name: mainName + ' K 线', type: 'candlestick', data: mainData.kline, itemStyle: { color: '#ef4444', color0: '#16a34a', borderColor: '#ef4444', borderColor0: '#16a34a' } },
                    { name: mainName + ' MA5', type: 'line', data: mainData.ma5, smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
                    { name: mainName + ' MA10', type: 'line', data: mainData.ma10, smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#667eea' } },
                    { name: '布林上轨', type: 'line', data: bollUpper, smooth: false, showSymbol: false, lineStyle: { width: 1, color: 'rgba(0, 0, 0, 0.5)' } },
                    { name: '布林中轨', type: 'line', data: bollMiddle, smooth: false, showSymbol: false, lineStyle: { width: 1, color: 'rgba(0, 0, 0, 0.5)' } },
                    { name: '布林下轨', type: 'line', data: bollLower, smooth: false, showSymbol: false, lineStyle: { width: 1, color: 'rgba(0, 0, 0, 0.5)' } },
                    { name: '成交量', type: 'bar', data: volumeData, itemStyle: { color: function(params) { return params.data && params.data.color ? params.data.color : '#ef4444'; } }, barMaxWidth: 20 },
                    { name: '周线 K 线', type: 'candlestick', data: weekData ? weekData.kline : [], itemStyle: { color: '#ef4444', color0: '#16a34a', borderColor: '#ef4444', borderColor0: '#16a34a' } },
                    { name: '周线 MA5', type: 'line', data: weekData ? weekData.ma5 : [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
                    { name: '周线 MA10', type: 'line', data: weekData ? weekData.ma10 : [], smooth: false, showSymbol: false, lineStyle: { width: 1, color: '#667eea' } }
                ],
                dataZoom: [{
                    end: 100
                }],
                graphic: [
                    { type: 'text', left: '9%', top: '2%', style: { text: mainName, font: 'bold 12px sans-serif', fill: '#667eea' }, silent: true },
                    { type: 'text', left: '9%', top: '59%', style: { text: '成交量', font: 'bold 12px sans-serif', fill: '#667eea' }, silent: true },
                    { type: 'text', left: '9%', top: '74%', style: { text: '周线', font: 'bold 12px sans-serif', fill: '#667eea' }, silent: true }
                ]
            });
            
            // 初始化时保持右端固定
            keepRightEndFixed();
        }
        
        function switchPeriod(period) {
            if (!currentStockCode) return;
            currentPeriod = period;
            document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadChart(currentStockCode, null, period);
        }
        
        // 重置所有筛选按钮状态
        function resetFilterButtons() {
            document.getElementById('holdingsBtn').classList.remove('active');
            document.getElementById('scoreHighBtn').classList.remove('active');
            document.getElementById('etfBtn')?.classList.remove('active');
        }
        
        // 行业筛选（始终生效，可以和其他筛选共存）
        function filterTable() {
            const industry = document.getElementById('industryFilter').value;
            const searchTerm = document.getElementById('stockSearch').value.toLowerCase().trim();
            const rows = document.querySelectorAll('#dataTable tbody tr');
            
            rows.forEach(row => {
                const stockIndustry = row.cells[0]?.textContent || '';
                const stockName = row.cells[2]?.textContent || '';
                const stockCode = row.cells[1]?.textContent || '';
                
                const industryMatch = !industry || stockIndustry === industry;
                const searchMatch = !searchTerm || stockName.toLowerCase().includes(searchTerm) || stockCode.toLowerCase().includes(searchTerm);
                
                // 如果有激活的特殊筛选（持仓/高分），先不管，让特殊筛选处理
                const isHoldingsFiltered = document.getElementById('holdingsBtn').classList.contains('active');
                const isScoreHighFiltered = document.getElementById('scoreHighBtn').classList.contains('active');
                
                if (isHoldingsFiltered || isScoreHighFiltered) {
                    // 有特殊筛选时，行业/搜索只作为二次筛选
                    row.dataset.industryMatch = industryMatch ? '1' : '0';
                    row.dataset.searchMatch = searchMatch ? '1' : '0';
                } else {
                    // 没有特殊筛选时，直接应用行业/搜索筛选
                    row.style.display = (industryMatch && searchMatch) ? '' : 'none';
                }
            });
        }
        
        // 切换持仓筛选（互斥，激活时重置其他筛选）
        function toggleHoldingsFilter() {
            const btn = document.getElementById('holdingsBtn');
            const isActive = btn.classList.toggle('active');
            
            if (isActive) {
                // 激活持仓筛选，重置其他
                document.getElementById('scoreHighBtn').classList.remove('active');
                document.getElementById('industryFilter').value = '';
                document.getElementById('stockSearch').value = '';
                
                // 只显示持仓股票
                const rows = document.querySelectorAll('#dataTable tbody tr');
                rows.forEach(row => {
                    const isHolding = row.classList.contains('holding');
                    row.style.display = isHolding ? '' : 'none';
                });
            } else {
                // 取消筛选，恢复默认
                filterTable();
            }
        }
        
        // 切换高分筛选（互斥，激活时重置其他筛选）
        function toggleScoreHighFilter() {
            const btn = document.getElementById('scoreHighBtn');
            const isActive = btn.classList.toggle('active');
            
            if (isActive) {
                // 激活高分筛选，重置其他
                document.getElementById('holdingsBtn').classList.remove('active');
                document.getElementById('etfBtn')?.classList.remove('active');
                document.getElementById('industryFilter').value = '';
                document.getElementById('stockSearch').value = '';
                
                // 只显示 9-10 分股票
                const rows = document.querySelectorAll('#dataTable tbody tr');
                rows.forEach(row => {
                    const isScoreHigh = row.classList.contains('score-high');
                    row.style.display = isScoreHigh ? '' : 'none';
                });
            } else {
                // 取消筛选，恢复默认
                filterTable();
            }
        }
        
        // 切换 ETF 筛选（互斥，激活时重置其他筛选，按涨幅排序）
        function toggleETFFilter() {
            const btn = document.getElementById('etfBtn');
            if (!btn) return;
            
            const isActive = btn.classList.toggle('active');
            
            if (isActive) {
                // 激活 ETF 筛选，重置其他
                document.getElementById('holdingsBtn').classList.remove('active');
                document.getElementById('scoreHighBtn').classList.remove('active');
                document.getElementById('industryFilter').value = '';
                document.getElementById('stockSearch').value = '';
                
                // 只显示 ETF，并按涨幅排序
                const table = document.getElementById('dataTable');
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                // 筛选出 ETF 行
                const etfRows = rows.filter(row => row.classList.contains('etf'));
                
                // 按 ETF 名称首字母排序（A-Z）
                etfRows.sort((a, b) => {
                    const nameA = a.cells[2]?.textContent || '';  // 第 3 列是股票名称
                    const nameB = b.cells[2]?.textContent || '';
                    return nameA.localeCompare(nameB, 'zh-CN');  // 按拼音首字母
                });
                
                // 重新插入排序后的行
                etfRows.forEach(row => tbody.appendChild(row));
                
                // 显示 ETF，隐藏其他
                rows.forEach(row => {
                    const isETF = row.classList.contains('etf');
                    row.style.display = isETF ? '' : 'none';
                });
            } else {
                // 取消筛选，恢复默认
                filterTable();
            }
        }
        
        // 左侧表格自然纵向滚动（不需要额外代码，浏览器默认行为）
        
        // 右侧 K 线图滚轮缩放时保持右端固定
        const chartSection = document.querySelector('.chart-section');
        if (chartSection) {
            chartSection.addEventListener('wheel', function(e) {
                if (e.deltaY !== 0) {
                    // 延迟一帧执行，让 ECharts 先处理滚轮事件
                    requestAnimationFrame(() => {
                        keepRightEndFixed();
                    });
                }
            }, { passive: true });
        }
        
        window.historicalData = {};
        
        function getKlineData(stockCode, period) {
            const key = stockCode + '_' + period;
            return window.historicalData[key] || null;
        }
    </script>
</body>
</html>`;
}

function saveHTML(html, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // 添加 UTF-8 BOM 确保 Windows 浏览器正确识别中文
    const bom = '\ufeff';
    // 使用 Buffer 写入确保编码正确
    const buffer = Buffer.from(bom + html, 'utf8');
    fs.writeFileSync(outputPath, buffer);
}

// ========================================
// 🚀 主程序
// ========================================

const inputFile = process.argv[2] || path.join(__dirname, '..', '..', 'output', 'excel', `${new Date().toISOString().split('T')[0].replace(/-/g, '')}_小斐选股_行业 top20.xlsx`);
const outputFile = process.argv[3] || path.join(__dirname, '..', '..', 'output', 'dashboard', '小斐智能选股 1.0.html');

// 从 Excel 文件名提取交易日期
const tradeDateMatch = inputFile.match(/(\d{8})_小斐选股/);
const tradeDate = tradeDateMatch ? tradeDateMatch[1] : new Date().toISOString().split('T')[0].replace(/-/g, '');
const formattedTradeDate = `${tradeDate.slice(0,4)}-${tradeDate.slice(4,6)}-${tradeDate.slice(6,8)}`;

console.log('========================================');
console.log('  📊 股票仪表盘 HTML 生成器 v3.3 (支持 ETF)');
console.log('========================================\n');

const data = readExcel(inputFile);

// 过滤排除的行业
const beforeFilter = data.length;
const afterFilter = data.filter(row => !CONFIG.excludedIndustries.includes(row['行业']));
const excludedCount = beforeFilter - afterFilter.length;

console.log(`📊 行业过滤：排除 ${CONFIG.excludedIndustries.join('、')}，剔除 ${excludedCount} 只股票`);

// 持仓股票已在 Excel 中，检查是否都在
const existingCodes = new Set(afterFilter.map(row => row['股票代码']?.replace('.SZ', '').replace('.SH', '')));
const holdingsFound = CONFIG.holdings.filter(code => existingCodes.has(code));

console.log(`\n💼 持仓股票检查：${holdingsFound.length}/${CONFIG.holdings.length} 只在 Excel 中`);
if (holdingsFound.length < CONFIG.holdings.length) {
    const missing = CONFIG.holdings.filter(code => !existingCodes.has(code));
    console.log(`   ⚠️ 缺失：${missing.join(', ')}\n`);
} else {
    console.log(`   ✅ 全部持仓股票都在 Excel 中\n`);
}
    
const filteredData = filterColumns(afterFilter, CONFIG.hiddenColumns);

// 按行业字母顺序排序
filteredData.sort((a, b) => a['行业'].localeCompare(b['行业'], 'zh-CN'));

// 获取所有行业（排除后的）
const allIndustries = [...new Set(filteredData.map(row => row[CONFIG.filter.industryColumn]).filter(Boolean))];
const industryScore10Count = {};
const industryTotalCount = {};  // 每个行业的总股票数

// 初始化股票行业的计数（后面会用 combinedData 重新计算）
allIndustries.forEach(ind => {
    industryScore10Count[ind] = 0;
    industryTotalCount[ind] = 0;
});

// 筛选器显示所有没被排除的行业（按名称排序）
const industries = allIndustries.sort();

const columns = Object.keys(filteredData[0] || {});

console.log(`📖 读取 Excel: ${inputFile}`);
console.log(`✅ 读取到 ${data.length} 行数据`);
console.log(`📊 原始列数：${columns.length}, 隐藏后：${Object.keys(filteredData[0] || {}).length}`);

// 【关键优化】只加载 Excel 中筛选后股票的历史数据（而非全部 CSV 数据）
const stockCodes = filteredData.map(row => row['股票代码']);
console.log('\n📖 加载股票历史数据...');
console.log(`   优化前：加载全部 1383 只股票`);
console.log(`   优化后：只加载 ${stockCodes.length} 只股票（Excel 中的筛选结果）`);

const historicalData = loadHistoricalDataForStocks(stockCodes);

console.log(`📊 为 ${filteredData.length} 只股票生成 K 线数据...`);

stockCodes.forEach(stockCode => {
    ['day', 'week', 'month'].forEach(period => {
        const data = getKlineData(stockCode, period);
        if (data) {
            historicalData[stockCode + '_' + period] = data;
        }
    });
});

// ========================================
// 📊 ETF 整合
// ========================================

console.log('\n🔍 读取 ETF 数据...');
const etfList = readETFList();
const etfData = readETFData();

let etfRows = [];
if (etfList.length > 0 && etfData) {
    console.log(`📊 处理 ETF 数据（剔除无历史数据的）...`);
    
    let skippedCount = 0;
    
    etfList.forEach(etf => {
        const history = etfData[etf.code];
        
        // 剔除无历史数据或数据不足的 ETF
        if (!history || history.length < 20) {
            skippedCount++;
            return;  // 跳过这只 ETF
        }
        
        // 计算 ETF 评分和量比
        const { score, details, latest, pctChange, volumeRatio, rsi6 } = calculateETFScore(etf.code, history);
        
        // 所有有数据的 ETF 都加入，不筛选分数
        etfRows.push({
            '股票代码': etf.code,
            '股票名称': etf.name,
            '行业': etf.category,
            '得分': score,  // 显示真实分数
            '涨幅%': pctChange.toFixed(2),
            '量比': volumeRatio.toFixed(2),  // 显示真实量比
            'RSI6': rsi6.toFixed(1),
            '日线金叉': details['日线金叉'] ? '✓' : '✗',
            '当日收红': details['当日收红'] ? '✓' : '✗',
            'RSI<70': details['RSI'] ? '✓' : '✗',
            '量比>1': details['量比'] ? '✓' : '✗',
            '涨幅<5%': details['涨幅'] ? '✓' : '✗',
            '14 日>-7%': details['14 日'] ? '✓' : '✗',
            '20 日>-10%': details['20 日'] ? '✓' : '✗',
            'MA20 向上': details['MA20 向上'] ? '✓' : '✗',
            '周线金叉': details['周线金叉'] ? '✓' : '✗',
            '3 月>3%': details['3 月'] ? '✓' : '✗',
            '_isETF': true,  // 标记为 ETF
            '_pctChange': pctChange  // 用于排序的原始数值
        });
    });
    
    // 为 ETF 加载 K 线数据
    console.log(`📊 为 ${etfRows.length} 只 ETF 生成 K 线数据...`);
    etfRows.forEach(etf => {
        const history = etfData[etf['股票代码']];
        if (history) {
            ['day', 'week', 'month'].forEach(period => {
                const processed = period === 'day' ? processDaily(history) : period === 'week' ? processWeekly(history) : processMonthly(history);
                if (processed) {
                    historicalData[etf['股票代码'] + '_' + period] = processed;
                }
            });
        }
    });
    
    console.log(`✅ ${etfRows.length} 只 ETF 已加入（非宽基，剔除 ${skippedCount} 只无数据）`);
} else {
    console.log('⚠️  ETF 数据不完整，跳过 ETF 整合');
}

// 合并股票和 ETF 数据
const combinedData = [...filteredData, ...etfRows];
console.log(`\n📊 合并后总计：${combinedData.length} 只（股票：${filteredData.length}, ETF: ${etfRows.length}）`);

// ========================================
// 🔍 最终数据质量检测
// ========================================
console.log('\n🔍 最终数据质量检测...');

// 检测列一致性（核心列）
const stockColumns = Object.keys(filteredData[0] || {});
const etfColumns = Object.keys(etfRows[0] || {});

// 核心必需列（股票和 ETF 都应该有）
const requiredColumns = ['股票代码', '股票名称', '行业', '得分'];
const stockHasAllRequired = requiredColumns.every(c => stockColumns.includes(c));
const etfHasAllRequired = requiredColumns.every(c => etfColumns.includes(c));

if (!stockHasAllRequired || !etfHasAllRequired) {
    console.log('❌ 核心列缺失！');
    if (!stockHasAllRequired) {
        const missing = requiredColumns.filter(c => !stockColumns.includes(c));
        console.log(`   - 股票数据缺少：${missing.join(', ')}`);
    }
    if (!etfHasAllRequired) {
        const missing = requiredColumns.filter(c => !etfColumns.includes(c));
        console.log(`   - ETF 数据缺少：${missing.join(', ')}`);
    }
    throw new Error('数据核心列缺失');
} else {
    console.log('✅ 核心列检查通过（股票代码、股票名称、行业、得分）');
}

// 检测乱码
let totalGarbled = 0;
combinedData.forEach((row, idx) => {
    Object.values(row).forEach(val => {
        if (typeof val === 'string' && containsGarbledText(val)) {
            totalGarbled++;
            if (totalGarbled <= 3) {
                console.log(`   ⚠️  第 ${idx+1} 行发现乱码：${val.substring(0, 30)}`);
            }
        }
    });
});

if (totalGarbled > 0) {
    console.log(`❌ 发现 ${totalGarbled} 处乱码，请检查数据源`);
    throw new Error('数据中包含乱码，请检查 ETF 列表和历史数据文件');
} else {
    console.log('✅ 未检测到乱码');
}

// 检测 ETF 名称
if (etfRows.length > 0) {
    const sampleETF = etfRows[0];
    console.log(`✅ ETF 数据示例：${sampleETF['股票代码']} | ${sampleETF['股票名称']} | ${sampleETF['行业']}`);
}

// 重新计算行业统计（使用 combinedData，包含股票和 ETF）
const allCategories = [...new Set(combinedData.map(row => row[CONFIG.filter.industryColumn]).filter(Boolean))];

// 清空并重新计算
allCategories.forEach(cat => {
    industryScore10Count[cat] = combinedData.filter(row => row[CONFIG.filter.industryColumn] === cat && (row['得分'] == 9 || row['得分'] == 10)).length;
    industryTotalCount[cat] = combinedData.filter(row => row[CONFIG.filter.industryColumn] === cat).length;
});

// 计算持仓数量和高分数量
const holdingsCount = combinedData.filter(row => {
    const code = row['股票代码']?.replace('.SZ', '').replace('.SH', '');
    return CONFIG.holdings.includes(code);
}).length;

const scoreHighCount = combinedData.filter(row => row['得分'] == 9 || row['得分'] == 10).length;

const html = generateHTML(combinedData, columns, industries, industryScore10Count, etfRows.length, holdingsCount, scoreHighCount);

const historicalDataStr = JSON.stringify(historicalData);
const htmlWithData = html.replace('window.historicalData = {};', `window.historicalData = ${historicalDataStr};`);

saveHTML(htmlWithData, outputFile);

console.log(`💾 HTML 已保存：${outputFile}`);
console.log(`\n⏱️  仪表盘生成完成！`);
console.log('\n========================================');
console.log('  ✅ 仪表盘生成完成！');
console.log('  📊 股票：' + filteredData.length + ' 只');
console.log('  📈 ETF: ' + etfRows.length + ' 只');
console.log('  📈 总计：' + combinedData.length + ' 只');
console.log('========================================');
