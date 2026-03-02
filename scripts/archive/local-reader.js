// 本地数据读取器
// 从 CSV 文件读取股票数据

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'daily');

/**
 * 读取单只股票的历史数据
 * @param {string} tsCode - 股票代码 (如：002270.SZ)
 * @returns {Array} 历史数据数组
 */
function readStockData(tsCode) {
    // 文件名直接用股票代码，如：000001.SZ.csv
    const filePath = path.join(DATA_DIR, `${tsCode}.csv`);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ 数据文件不存在：${filePath}`);
        return null;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) {
            return [];
        }
        
        // 解析表头
        const headers = lines[0].split(',');
        
        // 解析数据
        const data = lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index];
                
                // 数值转换
                if (header === 'trade_date') {
                    row[header] = value;
                } else if (['open', 'high', 'low', 'close', 'pre_close'].includes(header)) {
                    row[header] = parseFloat(value) || 0;
                } else if (['vol', 'amount'].includes(header)) {
                    row[header] = parseFloat(value) || 0;
                } else {
                    row[header] = value;
                }
            });
            return row;
        });
        
        return data;
        
    } catch (error) {
        console.error(`❌ 读取数据失败：${error.message}`);
        return null;
    }
}

/**
 * 读取多只股票的数据
 * @param {Array} tsCodes - 股票代码数组
 * @returns {Object} 股票数据字典
 */
function readMultipleStocks(tsCodes) {
    const result = {};
    
    for (const tsCode of tsCodes) {
        result[tsCode] = readStockData(tsCode);
    }
    
    return result;
}

/**
 * 获取所有已下载的股票代码
 * @returns {Array} 股票代码数组
 */
function getAllAvailableCodes() {
    if (!fs.existsSync(DATA_DIR)) {
        return [];
    }
    
    const files = fs.readdirSync(DATA_DIR);
    // 文件名就是股票代码，直接去掉.csv 后缀
    return files
        .filter(f => f.endsWith('.csv'))
        .map(f => f.replace('.csv', ''));
}

/**
 * 计算均线
 */
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * 检测指定日期的金叉/死叉
 */
function checkSignalOnDate(data, targetDate) {
    const targetIndex = data.findIndex(d => d.trade_date === targetDate);
    
    if (targetIndex === -1 || targetIndex < 9) {
        return { hasSignal: false, reason: '数据不足' };
    }
    
    const closes = data.map(d => d.close);
    
    const ma5_target = calculateMA(closes.slice(0, targetIndex + 1), 5);
    const ma10_target = calculateMA(closes.slice(0, targetIndex + 1), 10);
    const ma5_prev = calculateMA(closes.slice(0, targetIndex), 5);
    const ma10_prev = calculateMA(closes.slice(0, targetIndex), 10);
    
    const isGoldenCross = ma5_target > ma10_target && ma5_prev <= ma10_prev;
    const isDeathCross = ma5_target < ma10_target && ma5_prev >= ma10_prev;
    
    return {
        hasSignal: isGoldenCross || isDeathCross,
        isGoldenCross,
        isDeathCross,
        ma5: ma5_target.toFixed(2),
        ma10: ma10_target.toFixed(2),
        prevMa5: ma5_prev.toFixed(2),
        prevMa10: ma10_prev.toFixed(2),
        close: data[targetIndex].close,
        date: targetDate
    };
}

/**
 * 检测所有股票在指定日期的信号
 */
function scanAllStocks(targetDate) {
    console.log(`🔍 扫描 ${targetDate} 的信号...\n`);
    
    const codes = getAllAvailableCodes();
    console.log(`找到 ${codes.length} 只股票数据\n`);
    
    const goldenCrossStocks = [];
    const deathCrossStocks = [];
    
    for (const tsCode of codes) {
        const data = readStockData(tsCode);
        
        if (!data || data.length < 10) {
            continue;
        }
        
        const signal = checkSignalOnDate(data, targetDate);
        
        if (!signal.hasSignal) {
            continue;
        }
        
        const name = tsCode.split('.')[0];
        const result = {
            tsCode,
            name,
            ...signal
        };
        
        if (signal.isGoldenCross) {
            goldenCrossStocks.push(result);
        } else {
            deathCrossStocks.push(result);
        }
    }
    
    return { goldenCrossStocks, deathCrossStocks };
}

module.exports = {
    readStockData,
    readMultipleStocks,
    getAllAvailableCodes,
    calculateMA,
    checkSignalOnDate,
    scanAllStocks
};
