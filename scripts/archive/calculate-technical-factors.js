// 技术面因子计算模块
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const FACTORS_DIR = path.join(__dirname, 'data', 'factors');

// 确保因子目录存在
if (!fs.existsSync(FACTORS_DIR)) {
    fs.mkdirSync(FACTORS_DIR, { recursive: true });
}

/**
 * 读取 CSV 文件
 */
function readCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] ? values[i].trim() : '';
        });
        return row;
    });
    
    return data;
}

/**
 * 计算移动平均线
 */
function calculateMA(data, period, field = 'close') {
    if (data.length < period) return null;
    
    const values = data.slice(-period).map(d => parseFloat(d[field]));
    const sum = values.reduce((s, v) => s + v, 0);
    return sum / period;
}

/**
 * 计算 RSI
 */
function calculateRSI(data, period = 6) {
    if (data.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
        const change = parseFloat(data[i].close) - parseFloat(data[i-1].close);
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * 计算 ROC (价格变化率)
 */
function calculateROC(data, period = 5) {
    if (data.length < period) return null;
    
    const current = parseFloat(data[data.length - 1].close);
    const prev = parseFloat(data[data.length - period].close);
    
    return ((current - prev) / prev) * 100;
}

/**
 * 计算量比
 */
function calculateVolumeRatio(data, period = 5) {
    if (data.length < period) return null;
    
    const currentVol = parseFloat(data[data.length - 1].vol);
    const avgVol = data.slice(-period).reduce((s, d) => s + parseFloat(d.vol), 0) / period;
    
    return currentVol / avgVol;
}

/**
 * 计算布林带位置
 */
function calculateBollingerPosition(data, period = 20) {
    if (data.length < period) return null;
    
    const closes = data.slice(-period).map(d => parseFloat(d.close));
    const ma = closes.reduce((s, v) => s + v, 0) / period;
    const variance = closes.reduce((s, v) => s + Math.pow(v - ma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = ma + 2 * std;
    const lower = ma - 2 * std;
    const current = closes[closes.length - 1];
    
    return (current - lower) / (upper - lower);
}

/**
 * 计算 MACD
 */
function calculateMACD(data) {
    if (data.length < 26) return null;
    
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    
    if (ema12 === null || ema26 === null) return null;
    
    const dif = ema12 - ema26;
    const dea = calculateEMAOfDIF(data, 9); // 简化版
    
    return {
        dif,
        dea: dea || 0,
        macd: 2 * (dif - (dea || 0))
    };
}

/**
 * 计算 EMA
 */
function calculateEMA(data, period, field = 'close') {
    if (data.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = parseFloat(data[0].close);
    
    for (let i = 1; i < data.length; i++) {
        ema = (parseFloat(data[i].close) - ema) * multiplier + ema;
    }
    
    return ema;
}

/**
 * 计算 EMA of DIF (简化版)
 */
function calculateEMAOfDIF(data, period) {
    // 简化实现，实际需要完整 MACD 计算
    return null;
}

/**
 * 计算单只股票的技术面因子
 */
function calculateTechnicalFactors(stockData) {
    if (stockData.length < 60) return null;
    
    const latest = stockData[stockData.length - 1];
    
    return {
        // 均线
        ma5: calculateMA(stockData, 5),
        ma10: calculateMA(stockData, 10),
        ma20: calculateMA(stockData, 20),
        ma60: calculateMA(stockData, 60),
        
        // 均线排列
        ma5_above_ma10: calculateMA(stockData, 5) > calculateMA(stockData, 10),
        ma5_above_ma20: calculateMA(stockData, 5) > calculateMA(stockData, 20),
        ma10_above_ma20: calculateMA(stockData, 10) > calculateMA(stockData, 20),
        
        // 动量
        roc5: calculateROC(stockData, 5),
        roc10: calculateROC(stockData, 10),
        roc20: calculateROC(stockData, 20),
        
        // RSI
        rsi6: calculateRSI(stockData, 6),
        rsi12: calculateRSI(stockData, 12),
        
        // 成交量
        volumeRatio: calculateVolumeRatio(stockData, 5),
        
        // 布林带
        bollingerPosition: calculateBollingerPosition(stockData, 20),
        
        // MACD (简化)
        macd: calculateMACD(stockData),
        
        // 基础数据
        close: parseFloat(latest.close),
        changePercent: parseFloat(latest.pct_chg),
        vol: parseFloat(latest.vol),
        amount: parseFloat(latest.amount),
        
        // 时间
        tradeDate: latest.trade_date
    };
}

/**
 * Z-Score 标准化
 */
function zScoreNormalize(values) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return values.map(() => 0);
    
    return values.map(v => (v - mean) / std);
}

/**
 * 标准化因子数据
 */
function normalizeFactors(allFactors) {
    const numericFields = ['ma5', 'ma10', 'roc5', 'roc10', 'rsi6', 'volumeRatio', 'bollingerPosition'];
    
    const normalized = {};
    
    // 对每个数值字段进行 Z-Score 标准化
    for (const field of numericFields) {
        const values = Object.values(allFactors)
            .map(f => f.technical[field])
            .filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (values.length > 0) {
            const normalizedValues = zScoreNormalize(values);
            let valueIdx = 0;
            
            for (const tsCode in allFactors) {
                if (allFactors[tsCode].technical[field] !== null) {
                    allFactors[tsCode].technical[`${field}_zscore`] = normalizedValues[valueIdx++];
                }
            }
        }
    }
    
    return allFactors;
}

/**
 * 主函数：计算所有股票的技术面因子
 */
function calculateAllFactors() {
    console.log('========================================');
    console.log('  技术面因子计算');
    console.log('========================================\n');
    
    const files = ['sh_main.csv', 'sz_main.csv'];
    const allFactors = {};
    
    let totalStocks = 0;
    let successStocks = 0;
    
    for (const file of files) {
        const filePath = path.join(MERGED_DIR, file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ 文件不存在：${file}`);
            continue;
        }
        
        console.log(`📖 读取 ${file}...`);
        const data = readCSV(filePath);
        
        // 按股票代码分组
        const stockData = {};
        for (const row of data) {
            const tsCode = row.ts_code;
            if (!stockData[tsCode]) {
                stockData[tsCode] = [];
            }
            stockData[tsCode].push(row);
        }
        
        // 按日期排序
        for (const tsCode in stockData) {
            stockData[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        }
        
        totalStocks += Object.keys(stockData).length;
        
        // 计算因子
        for (const [tsCode, stockHistory] of Object.entries(stockData)) {
            const factors = calculateTechnicalFactors(stockHistory);
            
            if (factors) {
                allFactors[tsCode] = {
                    technical: factors
                };
                successStocks++;
            }
        }
        
        console.log(`✅ ${file} 完成\n`);
    }
    
    // 标准化
    console.log('📊 进行 Z-Score 标准化...\n');
    normalizeFactors(allFactors);
    
    // 保存结果
    const tradeDate = new Date().toISOString().split('T')[0];
    const outputFile = path.join(FACTORS_DIR, `technical_${tradeDate}.json`);
    
    const result = {
        calcDate: new Date().toISOString(),
        tradeDate,
        stats: {
            total: totalStocks,
            success: successStocks,
            failed: totalStocks - successStocks
        },
        factors: allFactors
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
    
    console.log('========================================');
    console.log('  计算完成');
    console.log('========================================\n');
    console.log(`总股票数：${totalStocks}`);
    console.log(`成功：${successStocks}`);
    console.log(`失败：${totalStocks - successStocks}\n`);
    console.log(`📁 结果已保存到：${outputFile}\n`);
    
    // 显示示例
    const sampleCodes = Object.keys(allFactors).slice(0, 5);
    console.log('📊 示例数据（前 5 只股票）:\n');
    sampleCodes.forEach(code => {
        const f = allFactors[code].technical;
        console.log(`${code}:`);
        console.log(`  收盘价：${f.close}`);
        console.log(`  涨跌幅：${f.changePercent}%`);
        console.log(`  MA5: ${f.ma5}`);
        console.log(`  RSI6: ${f.rsi6}`);
        console.log(`  量比：${f.volumeRatio}`);
        console.log(`  MA5_ZScore: ${f.ma5_zscore?.toFixed(2)}`);
        console.log('');
    });
    
    return result;
}

// 运行
calculateAllFactors();
