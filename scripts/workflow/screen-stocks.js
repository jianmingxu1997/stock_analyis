// 全股票池分析：10 指标评分 + 行业 Top5
const fs = require('fs');
const path = require('path');
const { utils, writeFileXLSX } = require('xlsx');

const STOCK_POOL_FILE = path.join(__dirname, '..', '..', 'data', 'pools', 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(__dirname, '..', '..', 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'output', 'excel', '全股票池分析_行业 Top5.xlsx');

console.log('========================================');
console.log('  全股票池分析：10 指标评分 + 行业 Top5');
console.log('========================================\n');

const startTime = Date.now();

// ========== 读取股票池 ==========
console.log('📖 读取股票池...\n');
const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stockPool = stockPoolData.stockPool;
console.log(`✅ 股票池：${stockPool.length}只\n`);

// ========== 读取历史数据 ==========
console.log('📖 读取历史数据...\n');

const priceHistory = {};

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const closeIdx = headers.indexOf('close');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const preCloseIdx = headers.indexOf('pre_close');
    const volIdx = headers.indexOf('vol');
    const pctChgIdx = headers.indexOf('pct_chg');
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        const tradeDate = values[tradeDateIdx];
        
        if (!priceHistory[tsCode]) {
            priceHistory[tsCode] = [];
        }
        
        priceHistory[tsCode].push({
            trade_date: tradeDate,
            close: parseFloat(values[closeIdx]) || 0,
            high: parseFloat(values[highIdx]) || 0,
            low: parseFloat(values[lowIdx]) || 0,
            pre_close: parseFloat(values[preCloseIdx]) || 1,
            vol: parseFloat(values[volIdx]) || 0,
            pct_chg: parseFloat(values[pctChgIdx]) || 0
        });
    }
});

Object.keys(priceHistory).forEach(tsCode => {
    priceHistory[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
});

console.log(`✅ 历史数据：${Object.keys(priceHistory).length}只股票\n`);

// ========== 工具函数 ==========
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ========== 计算 10 个指标 ==========
console.log('🔢 计算 10 个指标...\n');

const allStocksData = [];
let passedMust = 0;

stockPool.forEach(stock => {
    const tsCode = stock.tsCode;
    const history = priceHistory[tsCode];
    
    if (!history || history.length < 60) return;
    
    const latest = history[history.length - 1];
    const past20 = history.slice(-20);
    const past20Full = history.slice(-20);
    const past14 = history.slice(-14);
    const past60 = history.slice(-60);
    
    // ===== 计算指标 =====
    
    // 1. 日线 MA5 接近 MA10 (-0.5% 到 2%)
    const ma5_today = mean(past20.slice(-5).map(d => d.close));
    const ma10_today = mean(past20.slice(-10).map(d => d.close));
    const maDiff = (ma5_today - ma10_today) / ma10_today * 100;
    const rule1 = (maDiff >= -0.5 && maDiff <= 2);
    
    // 2. 当日收红
    const rule2 = (latest.pct_chg > 0);
    
    // 3. RSI6<70
    let gains = 0, losses = 0;
    for (let i = past20.length - 6; i < past20.length; i++) {
        const change = past20[i].close - past20[i-1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rsi6 = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
    const rule3 = (rsi6 < 70);
    
    // 4. 量比>1.0
    const avgVol3 = mean(past20.slice(-3).map(d => d.vol));
    const volumeRatio = avgVol3 > 0 ? latest.vol / avgVol3 : 1;
    const rule4 = (volumeRatio > 1.0);
    
    // 5. 涨幅<5%
    const rule5 = (latest.pct_chg < 5);
    
    // 6. 14 日跌幅<7%
    let rule6 = true;
    if (past14.length >= 14) {
        const price14daysAgo = past14[0].close;
        const change14d = (latest.close - price14daysAgo) / price14daysAgo * 100;
        rule6 = (change14d > -7);
    }
    
    // 7. 20 日跌幅<10%
    let rule7 = true;
    if (past20Full.length >= 20) {
        const price20daysAgo = past20Full[0].close;
        const change20d = (latest.close - price20daysAgo) / price20daysAgo * 100;
        rule7 = (change20d > -10);
    }
    
    // 8. 20 日均线向上
    const ma20_today = mean(past20Full.map(d => d.close));
    const ma20_5daysAgo = mean(history.slice(-25, -5).map(d => d.close));
    const rule8 = (ma20_today > ma20_5daysAgo);
    
    // 9. 周线 MA 差 -2% 到 5%
    let rule9 = true;
    const weeklyData = [];
    for (let i = 0; i < history.length; i += 5) {
        const weekData = history.slice(i, i + 5);
        if (weekData.length >= 3) {
            weeklyData.push({ close: weekData[weekData.length - 1].close });
        }
    }
    if (weeklyData.length >= 10) {
        const weekly_ma5 = mean(weeklyData.slice(-5).map(d => d.close));
        const weekly_ma10 = mean(weeklyData.slice(-10).map(d => d.close));
        const weekly_maDiff = (weekly_ma5 - weekly_ma10) / weekly_ma10 * 100;
        rule9 = (weekly_maDiff >= -2 && weekly_maDiff <= 5);
    }
    
    // 10. 3 月涨幅>3%
    let rule10 = true;
    if (past60.length >= 60) {
        const price60daysAgo = past60[0].close;
        const change60d = (latest.close - price60daysAgo) / price60daysAgo * 100;
        rule10 = (change60d > 3);
    }
    
    // 必须满足的 3 个条件
    const mustPass = rule1 && rule8 && rule10;
    
    if (mustPass) passedMust++;
    
    // 计算得分
    const score = [rule1, rule2, rule3, rule4, rule5, rule6, rule7, rule8, rule9, rule10]
        .filter(r => r).length;
    
    allStocksData.push({
        tsCode,
        name: stock.name,
        industry: stock.industry,
        marketCap: stock.marketCap,
        pe: stock.pe,
        pb: stock.pb,
        
        // 指标数据
        latestClose: latest.close,
        pct_chg: latest.pct_chg,
        ma5: ma5_today,
        ma10: ma10_today,
        maDiff,
        rsi6,
        volumeRatio,
        
        // 10 个规则
        rule1,  // 日线金叉
        rule2,  // 收红
        rule3,  // RSI
        rule4,  // 量比
        rule5,  // 涨幅
        rule6,  // 14 日
        rule7,  // 20 日
        rule8,  // MA20 向上
        rule9,  // 周线
        rule10, // 月线
        
        score,
        mustPass
    });
});

console.log(`✅ 计算完成：${allStocksData.length}只`);
console.log(`✅ 满足必须条件：${passedMust}只\n`);

// ========== 按行业分组，选 Top5 ==========
console.log('📊 按行业分组，选 Top5...\n');

const byIndustry = {};
allStocksData.forEach(s => {
    if (!byIndustry[s.industry]) byIndustry[s.industry] = [];
    byIndustry[s.industry].push(s);
});

const industryTop5 = {};
Object.keys(byIndustry).forEach(ind => {
    const stocks = byIndustry[ind];
    // 只选满足必须条件的
    const mustPassStocks = stocks.filter(s => s.mustPass);
    if (mustPassStocks.length === 0) return;
    
    // 按 score 排序
    mustPassStocks.sort((a, b) => b.score - a.score);
    
    // 取前 5
    industryTop5[ind] = mustPassStocks.slice(0, 5);
});

console.log(`✅ 有股票满足条件的行业：${Object.keys(industryTop5).length}个\n`);

// ========== 导出 Excel ==========
console.log('💾 导出 Excel...\n');

// 准备数据
const excelData = [];
Object.keys(industryTop5).sort().forEach(ind => {
    const stocks = industryTop5[ind];
    stocks.forEach((s, idx) => {
        excelData.push({
            '行业': ind,
            '排名': idx + 1,
            '股票代码': s.tsCode,
            '股票名称': s.name,
            '市值 (亿)': Math.round(s.marketCap).toFixed(0),
            'PE': s.pe && !isNaN(s.pe) ? parseFloat(s.pe).toFixed(2) : 'N/A',
            'PB': s.pb && !isNaN(s.pb) ? parseFloat(s.pb).toFixed(2) : 'N/A',
            '收盘价': s.latestClose.toFixed(2),
            '涨幅%': s.pct_chg.toFixed(2),
            'MA5': s.ma5.toFixed(2),
            'MA10': s.ma10.toFixed(2),
            'MA 差%': s.maDiff.toFixed(2),
            'RSI6': s.rsi6.toFixed(1),
            '量比': s.volumeRatio.toFixed(2),
            '日线金叉': s.rule1 ? '✓' : '✗',
            '当日收红': s.rule2 ? '✓' : '✗',
            'RSI<70': s.rule3 ? '✓' : '✗',
            '量比>1': s.rule4 ? '✓' : '✗',
            '涨幅<5%': s.rule5 ? '✓' : '✗',
            '14 日>-7%': s.rule6 ? '✓' : '✗',
            '20 日>-10%': s.rule7 ? '✓' : '✗',
            'MA20 向上': s.rule8 ? '✓' : '✗',
            '周线金叉': s.rule9 ? '✓' : '✗',
            '3 月>3%': s.rule10 ? '✓' : '✗',
            '得分': s.score,
            '必须条件': s.mustPass ? '是' : '否'
        });
    });
    // 添加空行分隔行业
    excelData.push({});
});

// 创建 workbook
const wb = utils.book_new();
const ws = utils.json_to_sheet(excelData);

// 设置列宽
ws['!cols'] = [
    { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }
];

utils.book_append_sheet(wb, ws, '行业 Top5');

// 保存
writeFileXLSX(wb, OUTPUT_FILE);
console.log(`📁 Excel 已保存到：${OUTPUT_FILE}\n`);

// ========== 显示统计 ==========
console.log('========================================');
console.log('  📊 统计结果');
console.log('========================================\n');

console.log('行业分布 (按满足条件股票数):\n');
Object.entries(industryTop5)
    .map(([ind, stocks]) => [ind, stocks.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([ind, count]) => {
        console.log(`   ${ind.padEnd(12)} ${count}只`);
    });

const avgScore = mean(allStocksData.filter(s => s.mustPass).map(s => s.score));
console.log(`\n📈 平均指标 (满足必须条件的股票):\n`);
console.log(`   平均得分：${avgScore.toFixed(2)}`);
console.log(`   平均 RSI6: ${mean(allStocksData.filter(s => s.mustPass).map(s => s.rsi6)).toFixed(1)}`);
console.log(`   平均量比：${mean(allStocksData.filter(s => s.mustPass).map(s => s.volumeRatio)).toFixed(2)}`);
console.log(`   平均涨幅：${mean(allStocksData.filter(s => s.mustPass).map(s => s.pct_chg)).toFixed(2)}%`);

console.log('\n========================================');
console.log('  ✅ 分析完成！');
console.log('========================================\n');

console.log(`⏱️  总耗时：${((Date.now() - startTime)/1000).toFixed(2)}秒\n`);
