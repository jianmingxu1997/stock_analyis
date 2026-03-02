// 简化版股票池筛选 - 只用本地数据
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-simple.json');

/**
 * 从合并的 CSV 文件中筛选股票
 */
function filterStockPool() {
    console.log('========================================');
    console.log('  股票池筛选（简化版 - 本地数据）');
    console.log('========================================\n');
    
    // 筛选规则
    const rules = {
        excludeST: true,              // 排除 ST
        excludeChiNext: true,         // 排除创业板 (300/301)
        excludeStar: true,            // 排除科创板 (688/689)
        excludeBSE: true,             // 排除北交所 (4/8/920)
        minMarketCap: 100,            // 最小市值 100 亿
        minListDays: 180              // 上市至少 180 天
    };
    
    console.log('📋 筛选规则:\n');
    console.log(`  ✅ 排除 ST 股票`);
    console.log(`  ✅ 排除创业板 (300/301 开头)`);
    console.log(`  ✅ 排除科创板 (688/689 开头)`);
    console.log(`  ✅ 排除北交所 (4/8/920 开头)`);
    console.log(`  ✅ 最小市值：${rules.minMarketCap}亿元 (需东财数据)`);
    console.log(`  ✅ 上市天数：>${rules.minListDays}天 (需东财数据)`);
    console.log(`  ℹ️  市值和上市天数需后续从东财获取\n`);
    
    // 读取所有 CSV 文件
    const files = fs.readdirSync(MERGED_DIR).filter(f => f.endsWith('.csv'));
    console.log(`📖 找到 ${files.length} 个数据文件\n`);
    
    const pool = [];
    const excluded = {
        ST: 0,
        ChiNext: 0,
        Star: 0,
        BSE: 0,
        Other: 0
    };
    
    for (const file of files) {
        const filePath = path.join(MERGED_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) continue;
        
        const headers = lines[0].split(',').map(h => h.trim());
        const tsCodeIdx = headers.indexOf('ts_code');
        const tradeDateIdx = headers.indexOf('trade_date');
        const closeIdx = headers.indexOf('close');
        
        // 提取每只股票的最新数据
        const stockData = {};
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const tsCode = values[tsCodeIdx];
            const tradeDate = values[tradeDateIdx];
            const close = parseFloat(values[closeIdx]);
            
            if (!stockData[tsCode] || tradeDate > stockData[tsCode].tradeDate) {
                stockData[tsCode] = { tsCode, tradeDate, close };
            }
        }
        
        // 筛选
        for (const [tsCode, data] of Object.entries(stockData)) {
            const code = tsCode.split('.')[0];
            const market = tsCode.split('.')[1];
            
            // 排除 ST
            if (tsCode.includes('ST')) {
                excluded.ST++;
                continue;
            }
            
            // 排除创业板
            if (rules.excludeChiNext && (code.startsWith('300') || code.startsWith('301'))) {
                excluded.ChiNext++;
                continue;
            }
            
            // 排除科创板
            if (rules.excludeStar && (code.startsWith('688') || code.startsWith('689'))) {
                excluded.Star++;
                continue;
            }
            
            // 排除北交所
            if (rules.excludeBSE && (code.startsWith('4') || code.startsWith('8') || code.startsWith('920'))) {
                excluded.BSE++;
                continue;
            }
            
            // 加入股票池
            pool.push({
                tsCode,
                code,
                market,
                latestDate: data.tradeDate,
                latestClose: data.close
            });
        }
    }
    
    console.log('========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    const totalProcessed = pool.length + excluded.ST + excluded.ChiNext + excluded.Star + excluded.BSE + excluded.Other;
    
    console.log(`处理股票数：${totalProcessed}`);
    console.log(`筛选后股票数：${pool.length}`);
    console.log(`排除股票数：${totalProcessed - pool.length}`);
    console.log(`筛选比例：${(pool.length / totalProcessed * 100).toFixed(1)}%\n`);
    
    console.log('排除原因统计:\n');
    console.log(`  ST 股票：${excluded.ST}`);
    console.log(`  创业板：${excluded.ChiNext}`);
    console.log(`  科创板：${excluded.Star}`);
    console.log(`  北交所：${excluded.BSE}`);
    console.log(`  其他：${excluded.Other}\n`);
    
    // 按代码排序
    pool.sort((a, b) => a.code.localeCompare(b.code));
    
    // 保存结果
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: {
            total: totalProcessed,
            filtered: pool.length,
            excluded: totalProcessed - pool.length
        },
        excludedReasons: excluded,
        stockPool: pool
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示前 20 只
    console.log('📊 前 20 只股票:\n');
    console.log('排名 | 代码       | 市场 | 最新日期  | 收盘价');
    console.log('-----|------------|------|-----------|--------');
    
    pool.slice(0, 20).forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.market} | ${s.latestDate} | ${s.latestClose.toFixed(2)}`);
    });
    
    console.log('\n========================================\n');
    
    console.log('💡 下一步:\n');
    console.log('  1. 从东财获取市值数据，筛选<100 亿的');
    console.log('  2. 从东财获取上市日期，筛选<180 天的');
    console.log('  3. 保存最终股票池\n');
    
    return pool;
}

filterStockPool();
