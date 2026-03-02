// 计算并对比两只股票的因子
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'stock-comparison.json');

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
 * 筛选特定股票数据
 */
function filterStock(data, tsCode) {
    return data.filter(row => row.ts_code === tsCode)
               .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
}

/**
 * 计算技术面因子
 */
function calculateTechnicalFactors(stockData) {
    if (stockData.length < 60) return null;
    
    const latest = stockData[0];
    const prev5 = stockData.slice(0, 5);
    const prev10 = stockData.slice(0, 10);
    const prev20 = stockData.slice(0, 20);
    const prev60 = stockData.slice(0, 60);
    
    // 均线
    const ma5 = prev5.reduce((s, r) => s + parseFloat(r.close), 0) / 5;
    const ma10 = prev10.reduce((s, r) => s + parseFloat(r.close), 0) / 10;
    const ma20 = prev20.reduce((s, r) => s + parseFloat(r.close), 0) / 20;
    const ma60 = prev60.reduce((s, r) => s + parseFloat(r.close), 0) / 60;
    
    // 均线排列
    const maBullish = ma5 > ma10 && ma10 > ma20 && ma20 > ma60;
    const ma5Above10 = ma5 > ma10;
    const ma5Above20 = ma5 > ma20;
    
    // 涨跌幅
    const close = parseFloat(latest.close);
    const preClose = parseFloat(latest.pre_close);
    const changePercent = ((close - preClose) / preClose * 100);
    
    // 5 日/10 日/20 日动量
    const roc5 = ((close - parseFloat(prev5[4].close)) / parseFloat(prev5[4].close) * 100);
    const roc10 = ((close - parseFloat(prev10[9].close)) / parseFloat(prev10[9].close) * 100);
    const roc20 = ((close - parseFloat(prev20[19].close)) / parseFloat(prev20[19].close) * 100);
    
    // RSI (6 日)
    const gains = [];
    const losses = [];
    for (let i = 1; i < Math.min(7, stockData.length); i++) {
        const diff = parseFloat(stockData[i-1].close) - parseFloat(stockData[i].close);
        if (diff > 0) {
            gains.push(diff);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(diff));
        }
    }
    const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length;
    const avgLoss = losses.reduce((s, v) => s + v, 0) / losses.length;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi6 = 100 - (100 / (1 + rs));
    
    // 量比
    const latestVol = parseFloat(latest.vol);
    const avgVol5 = prev5.reduce((s, r) => s + parseFloat(r.vol), 0) / 5;
    const volumeRatio = latestVol / avgVol5;
    
    // 振幅
    const high = parseFloat(latest.high);
    const low = parseFloat(latest.low);
    const amplitude = ((high - low) / preClose * 100);
    
    // 布林带
    const std20 = Math.sqrt(prev20.reduce((s, r) => s + Math.pow(parseFloat(r.close) - ma20, 2), 0) / 20);
    const bollUpper = ma20 + 2 * std20;
    const bollLower = ma20 - 2 * std20;
    const bollPosition = (close - bollLower) / (bollUpper - bollLower);
    
    return {
        // 价格
        close,
        changePercent: changePercent.toFixed(2),
        
        // 均线
        ma5: ma5.toFixed(2),
        ma10: ma10.toFixed(2),
        ma20: ma20.toFixed(2),
        ma60: ma60.toFixed(2),
        maBullish,
        ma5Above10,
        ma5Above20,
        
        // 动量
        roc5: roc5.toFixed(2),
        roc10: roc10.toFixed(2),
        roc20: roc20.toFixed(2),
        
        // RSI
        rsi6: rsi6.toFixed(2),
        
        // 成交量
        volumeRatio: volumeRatio.toFixed(2),
        
        // 振幅
        amplitude: amplitude.toFixed(2),
        
        // 布林带
        bollPosition: bollPosition.toFixed(2)
    };
}

/**
 * 计算基本面因子
 */
function calculateFundamentalFactors(stockData) {
    // 基本面数据需要从 Tushare 获取，这里用模拟数据
    // 实际使用时从 Tushare API 获取
    
    return {
        // 估值 (示例数据)
        pe: 'N/A (需 Tushare)',
        pb: 'N/A (需 Tushare)',
        ps: 'N/A (需 Tushare)',
        
        // 盈利 (示例数据)
        roe: 'N/A (需 Tushare)',
        roa: 'N/A (需 Tushare)',
        grossMargin: 'N/A (需 Tushare)',
        netMargin: 'N/A (需 Tushare)',
        
        // 成长 (示例数据)
        revGrowth: 'N/A (需 Tushare)',
        profitGrowth: 'N/A (需 Tushare)',
        
        note: '基本面数据需从 Tushare 获取，已记录待获取列表'
    };
}

/**
 * 计算市场面因子
 */
function calculateMarketFactors(stockData) {
    const latest = stockData[0];
    
    // 需要获取总股本数据，这里简化处理
    return {
        // 规模
        totalCap: 'N/A (需股本数据)',
        floatCap: 'N/A (需股本数据)',
        
        // 流动性
        avgTurnover20: 'N/A (需计算)',
        
        // 相对强度 (需要大盘数据)
        relativeStrength: 'N/A (需大盘数据)',
        
        note: '市场面因子需补充股本和大盘数据'
    };
}

/**
 * 主函数
 */
function main() {
    console.log('========================================');
    console.log('  股票因子对比分析');
    console.log('========================================\n');
    
    const stocks = [
        { code: '002046.SZ', name: '国机精工' },
        { code: '002270.SZ', name: '华明装备' }
    ];
    
    // 读取深市主板数据
    console.log('📖 读取 sz_main.csv...');
    const szData = readCSV(path.join(MERGED_DIR, 'sz_main.csv'));
    console.log(`✅ 读取到 ${szData.length} 行数据\n`);
    
    const results = {};
    
    for (const { code, name } of stocks) {
        console.log(`📊 分析 ${name} (${code})...`);
        
        const stockData = filterStock(szData, code);
        
        if (stockData.length === 0) {
            console.log(`❌ 未找到 ${code} 数据\n`);
            continue;
        }
        
        console.log(`   数据条数：${stockData.length}`);
        
        const latest = stockData[0];
        console.log(`   最新日期：${latest.trade_date}`);
        console.log(`   最新收盘价：${latest.close}\n`);
        
        // 计算因子
        const technical = calculateTechnicalFactors(stockData);
        const fundamental = calculateFundamentalFactors(stockData);
        const market = calculateMarketFactors(stockData);
        
        results[code] = {
            name,
            code,
            tradeDate: latest.trade_date,
            technical,
            fundamental,
            market
        };
    }
    
    // 输出对比
    console.log('\n========================================');
    console.log('  因子对比结果');
    console.log('========================================\n');
    
    console.log('因子类别          | 国机精工      | 华明装备');
    console.log('-----------------|--------------|--------------');
    
    const s1 = results['002046.SZ'];
    const s2 = results['002270.SZ'];
    
    if (s1 && s2 && s1.technical && s2.technical) {
        console.log(`收盘价 (元)        | ${s1.technical.close.toFixed(2).padStart(12)} | ${s2.technical.close.toFixed(2).padStart(12)}`);
        console.log(`涨跌幅 (%)        | ${s1.technical.changePercent.padStart(12)} | ${s2.technical.changePercent.padStart(12)}`);
        console.log(`-----------------|--------------|--------------`);
        console.log(`MA5 (元)          | ${s1.technical.ma5.padStart(12)} | ${s2.technical.ma5.padStart(12)}`);
        console.log(`MA10 (元)         | ${s1.technical.ma10.padStart(12)} | ${s2.technical.ma10.padStart(12)}`);
        console.log(`MA20 (元)         | ${s1.technical.ma20.padStart(12)} | ${s2.technical.ma20.padStart(12)}`);
        console.log(`MA60 (元)         | ${s1.technical.ma60.padStart(12)} | ${s2.technical.ma60.padStart(12)}`);
        console.log(`-----------------|--------------|--------------`);
        console.log(`均线多头排列      | ${s1.technical.maBullish ? '是'.padStart(10) : '否'.padStart(10)} | ${s2.technical.maBullish ? '是'.padStart(10) : '否'.padStart(10)}`);
        console.log(`MA5>MA10         | ${s1.technical.ma5Above10 ? '是'.padStart(10) : '否'.padStart(10)} | ${s2.technical.ma5Above10 ? '是'.padStart(10) : '否'.padStart(10)}`);
        console.log(`-----------------|--------------|--------------`);
        console.log(`5 日动量 (%)      | ${s1.technical.roc5.padStart(12)} | ${s2.technical.roc5.padStart(12)}`);
        console.log(`10 日动量 (%)     | ${s1.technical.roc10.padStart(12)} | ${s2.technical.roc10.padStart(12)}`);
        console.log(`20 日动量 (%)     | ${s1.technical.roc20.padStart(12)} | ${s2.technical.roc20.padStart(12)}`);
        console.log(`-----------------|--------------|--------------`);
        console.log(`RSI(6)           | ${s1.technical.rsi6.padStart(12)} | ${s2.technical.rsi6.padStart(12)}`);
        console.log(`量比             | ${s1.technical.volumeRatio.padStart(12)} | ${s2.technical.volumeRatio.padStart(12)}`);
        console.log(`振幅 (%)         | ${s1.technical.amplitude.padStart(12)} | ${s2.technical.amplitude.padStart(12)}`);
        console.log(`布林带位置       | ${s1.technical.bollPosition.padStart(12)} | ${s2.technical.bollPosition.padStart(12)}`);
    }
    
    console.log('\n========================================\n');
    
    // 保存结果
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
    console.log(`📁 详细结果已保存到：${OUTPUT_FILE}\n`);
}

main();
