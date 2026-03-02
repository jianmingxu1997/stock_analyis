// 用 260227_total_stocks.csv 筛选股票池
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'data', '260227_total_stocks.csv');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');

console.log('========================================');
console.log('  股票池筛选（使用 260227_total_stocks.csv）');
console.log('========================================\n');

// 读取 CSV
const content = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = content.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim());

console.log(`📊 字段：${headers.join(', ')}\n`);

// 解析数据
const stocks = [];
for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => {
        row[h] = values[idx] ? values[idx].trim() : '';
    });
    stocks.push(row);
}

console.log(`📖 读取到 ${stocks.length} 只股票\n`);

// 筛选规则
const rules = {
    excludeST: true,
    excludeChiNext: true,
    excludeStar: true,
    excludeBSE: true,
    minMarketCap: 100  // 亿元
};

console.log('📋 筛选规则:');
console.log('  ✅ 排除 ST');
console.log('  ✅ 排除创业板');
console.log('  ✅ 排除科创板');
console.log('  ✅ 排除北交所');
console.log('  ✅ 市值≥100 亿\n');

// 需要股价数据来计算市值 - 从 merged CSV 获取
const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const priceMap = {};

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',');
        const closeIdx = headers.indexOf('close');
        const tsCodeIdx = headers.indexOf('ts_code');
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const tsCode = values[tsCodeIdx];
            const close = parseFloat(values[closeIdx]);
            if (!priceMap[tsCode]) {
                priceMap[tsCode] = close;
            }
        }
    }
});

console.log(`💰 加载了 ${Object.keys(priceMap).length} 只股票的价格\n`);

// 筛选
const finalPool = [];
const excluded = {
    ST: 0,
    ChiNext: 0,
    Star: 0,
    BSE: 0,
    SmallCap: 0,
    NoPrice: 0
};

for (const stock of stocks) {
    const tsCode = stock.ts_code;
    const code = tsCode.split('.')[0];
    
    // 排除 ST
    if (stock.name.includes('ST')) {
        excluded.ST++;
        continue;
    }
    
    // 排除创业板
    if (code.startsWith('300') || code.startsWith('301')) {
        excluded.ChiNext++;
        continue;
    }
    
    // 排除科创板
    if (code.startsWith('688') || code.startsWith('689')) {
        excluded.Star++;
        continue;
    }
    
    // 排除北交所
    if (code.startsWith('4') || code.startsWith('8') || code.startsWith('920')) {
        excluded.BSE++;
        continue;
    }
    
    // 获取股价
    const price = priceMap[tsCode];
    if (!price) {
        excluded.NoPrice++;
        continue;
    }
    
    // 计算市值（总股本 × 股价）
    // total_share 单位可能是亿股，需要确认
    const totalShare = parseFloat(stock.total_share);
    const marketCap = totalShare * price;  // 亿元
    
    if (marketCap < rules.minMarketCap) {
        excluded.SmallCap++;
        continue;
    }
    
    finalPool.push({
        tsCode,
        name: stock.name,
        industry: stock.industry,
        price,
        totalShare,
        marketCap,
        pe: stock.pe,
        pb: stock.pb,
        listDate: stock.list_date
    });
}

console.log('========================================');
console.log('  筛选结果');
console.log('========================================\n');

console.log(`原始：${stocks.length}只`);
console.log(`最终：${finalPool.length}只`);
console.log(`排除：${stocks.length - finalPool.length}只\n`);

console.log('排除原因:');
console.log(`  ST: ${excluded.ST}`);
console.log(`  创业板：${excluded.ChiNext}`);
console.log(`  科创板：${excluded.Star}`);
console.log(`  北交所：${excluded.BSE}`);
console.log(`  市值<100 亿：${excluded.SmallCap}`);
console.log(`  无股价：${excluded.NoPrice}\n`);

// 按市值排序
finalPool.sort((a, b) => b.marketCap - a.marketCap);

// 保存
const result = {
    filterDate: new Date().toISOString(),
    source: '260227_total_stocks.csv',
    rules,
    stats: {
        initial: stocks.length,
        final: finalPool.length,
        excluded: stocks.length - finalPool.length
    },
    excludedReasons: excluded,
    stockPool: finalPool
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 显示前 20
console.log('📊 市值前 20 股票:\n');
console.log('排名 | 代码       | 名称     | 行业     | 股价   | 总股本 (亿) | 市值 (亿) | PE');
console.log('-----|------------|----------|----------|--------|-------------|-----------|-----');

finalPool.slice(0, 20).forEach((s, i) => {
    console.log(`${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ${s.price.toFixed(2).padStart(6)} | ${s.totalShare.toFixed(2).padStart(11)} | ${s.marketCap.toFixed(2).padStart(9)} | ${s.pe}`);
});

console.log('\n========================================\n');
