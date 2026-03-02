// 计算市场面因子
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const TECHNICAL_FILE = path.join(__dirname, 'data', 'factors', 'technical_2026-03-01.json');
const OUTPUT_FILE = path.join(__dirname, 'data', 'factors', 'market-factors-2026-03-01.json');

console.log('========================================');
console.log('  计算市场面因子');
console.log('========================================\n');

// 读取股票池（有流通股本数据）
console.log('📖 读取股票池...');
const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stockPool = stockPoolData.stockPool;

// 创建股票代码到流通股本的映射
const floatShareMap = {};
stockPool.forEach(stock => {
    // total_share 是总股本（亿股），需要转换为股
    floatShareMap[stock.tsCode] = {
        floatShare: stock.totalShare * 1e8,  // 亿股转股
        totalShare: stock.totalShare * 1e8
    };
});
console.log(`✅ 流通股本数据：${Object.keys(floatShareMap).length}只\n`);

// 读取技术面因子（有每日行情数据）
console.log('📖 读取技术面因子...');
const technicalData = JSON.parse(fs.readFileSync(TECHNICAL_FILE, 'utf8'));
console.log(`✅ 技术面因子：${Object.keys(technicalData.factors).length}只\n`);

// 从 merged CSV 读取历史行情数据（用于计算 RPS 和均成交额）
console.log('📖 读取历史行情数据...\n');

const priceHistory = {};  // tsCode -> [每日行情]

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 文件不存在：${file}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const closeIdx = headers.indexOf('close');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const preCloseIdx = headers.indexOf('pre_close');
    const amountIdx = headers.indexOf('amount');
    const volIdx = headers.indexOf('vol');
    const pctChgIdx = headers.indexOf('pct_chg');
    
    // 按股票代码分组
    const stockData = {};
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        
        if (!stockData[tsCode]) {
            stockData[tsCode] = [];
        }
        
        stockData[tsCode].push({
            trade_date: values[tradeDateIdx],
            close: parseFloat(values[closeIdx]) || 0,
            high: parseFloat(values[highIdx]) || 0,
            low: parseFloat(values[lowIdx]) || 0,
            pre_close: parseFloat(values[preCloseIdx]) || 1,
            amount: parseFloat(values[amountIdx]) || 0,  // 成交额（千元）
            vol: parseFloat(values[volIdx]) || 0,  // 成交量（手）
            pct_chg: parseFloat(values[pctChgIdx]) || 0  // 涨跌幅%
        });
    }
    
    // 按日期排序（旧到新）
    Object.keys(stockData).forEach(tsCode => {
        stockData[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        priceHistory[tsCode] = stockData[tsCode];
    });
    
    console.log(`✅ ${file}: ${Object.keys(stockData).length}只股票`);
});

console.log(`\n✅ 历史行情数据：${Object.keys(priceHistory).length}只股票\n`);

// 计算市场面因子
console.log('🔢 计算市场面因子...\n');

const marketFactors = {};
let calculated = 0;
let noData = 0;
let noFloatShare = 0;

Object.keys(technicalData.factors).forEach(tsCode => {
    const history = priceHistory[tsCode];
    const floatShareInfo = floatShareMap[tsCode];
    
    if (!history || history.length < 20) {
        noData++;
        marketFactors[tsCode] = null;
        return;
    }
    
    if (!floatShareInfo) {
        noFloatShare++;
        marketFactors[tsCode] = null;
        return;
    }
    
    const latest = history[history.length - 1];
    const prev20 = history.slice(-20);
    const prev120 = history.slice(-120);
    
    // 1. 换手率 = 成交量 / 流通股本 * 100
    // vol 单位是手（100 股），需要转换
    const turnoverRatio = (latest.vol * 100) / floatShareInfo.floatShare * 100;
    
    // 2. 日均成交额 = 近 20 日成交额平均（万元）
    const avgTurnover20 = prev20.reduce((s, d) => s + d.amount, 0) / prev20.length / 10;  // 千元转万元
    
    // 3. 振幅 = (最高 - 最低) / 昨收 * 100
    const amplitude = (latest.high - latest.low) / latest.pre_close * 100;
    
    // 4. 相对大盘强度（简化版：用个股涨幅代表）
    // 真正的大盘强度需要上证指数数据，这里先用个股涨幅
    const relativeStrength = latest.pct_chg;
    
    // 5. RPS120 = 股价在 120 日内的百分位排名
    const closePrices = prev120.map(d => d.close);
    const currentClose = latest.close;
    const rank = closePrices.filter(p => p <= currentClose).length;
    const rps120 = (rank / prev120.length) * 100;
    
    marketFactors[tsCode] = {
        turnoverRatio,           // 换手率%
        avgTurnover20,           // 20 日日均成交额（万元）
        amplitude,               // 振幅%
        relativeStrength,        // 相对强度（%）
        rps120                   // RPS120（0-100）
    };
    
    calculated++;
    
    // 显示进度
    if (calculated % 500 === 0) {
        console.log(`   已计算：${calculated}只`);
    }
});

console.log(`\n✅ 计算成功：${calculated}只`);
console.log(`⚠️ 无行情数据：${noData}只`);
console.log(`⚠️ 无流通股本：${noFloatShare}只`);
console.log(`📊 成功率：${(calculated / Object.keys(technicalData.factors).length * 100).toFixed(1)}%\n`);

// 保存结果
const result = {
    calcDate: new Date().toISOString(),
    factorDate: '2026-03-01',
    stats: {
        total: Object.keys(technicalData.factors).length,
        calculated,
        noData,
        noFloatShare,
        successRate: (calculated / Object.keys(technicalData.factors).length * 100).toFixed(1)
    },
    factors: marketFactors
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 显示示例
console.log('📊 示例数据（前 5 只）:\n');

const sampleCodes = Object.keys(marketFactors).filter(k => marketFactors[k]).slice(0, 5);
sampleCodes.forEach(code => {
    const f = marketFactors[code];
    console.log(`${code}:`);
    console.log(`   换手率：${f.turnoverRatio.toFixed(2)}%`);
    console.log(`   20 日日均成交额：${(f.avgTurnover20/10000).toFixed(2)}亿元`);
    console.log(`   振幅：${f.amplitude.toFixed(2)}%`);
    console.log(`   相对强度：${f.relativeStrength.toFixed(2)}%`);
    console.log(`   RPS120: ${f.rps120.toFixed(2)}`);
    console.log('');
});

console.log('========================================');
console.log('  计算完成！');
console.log('========================================\n');
