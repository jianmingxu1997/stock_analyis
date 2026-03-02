// 快速股票池筛选 - 中等并发
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-simple.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final-fast.json');

async function getMarketCap(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f116,f117`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });
        
        if (!response.data.data) return null;
        
        return {
            totalMv: (response.data.data.f116 || 0) / 100000000,
            floatMv: (response.data.data.f117 || 0) / 100000000
        };
    } catch (error) {
        return null;
    }
}

async function main() {
    console.log('========================================');
    console.log('  快速股票池筛选（中等并发）');
    console.log('========================================\n');
    
    const poolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = poolData.stockPool;
    
    console.log(`📖 股票池：${stocks.length}只\n`);
    console.log('🔍 开始筛选...\n');
    
    const rules = { minMarketCap: 100 };
    const finalPool = [];
    const excluded = { smallCap: 0, other: 0 };
    
    // 中等并发：20
    const batchSize = 20;
    const batches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const batch = stocks.slice(i * batchSize, (i + 1) * batchSize);
        
        const results = await Promise.all(batch.map(async (stock) => {
            const info = await getMarketCap(stock.tsCode);
            
            if (!info) {
                excluded.other++;
                return null;
            }
            
            if (info.totalMv < rules.minMarketCap) {
                excluded.smallCap++;
                return null;
            }
            
            return { ...stock, ...info };
        }));
        
        finalPool.push(...results.filter(r => r !== null));
        
        const current = Math.min((i + 1) * batchSize, stocks.length);
        const percent = ((current / stocks.length) * 100).toFixed(1);
        console.log(`   进度：${percent}% (${current}/${stocks.length}) 已筛选：${finalPool.length}只`);
        
        // 批间隔 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    console.log(`原始：${stocks.length}只`);
    console.log(`最终：${finalPool.length}只`);
    console.log(`排除：${stocks.length - finalPool.length}只\n`);
    
    console.log('排除原因:');
    console.log(`  市值<100 亿：${excluded.smallCap}`);
    console.log(`  无数据：${excluded.other}\n`);
    
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: { initial: stocks.length, final: finalPool.length, excluded: stocks.length - finalPool.length },
        excludedReasons: excluded,
        stockPool: finalPool.sort((a, b) => b.totalMv - a.totalMv)
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示前 20
    console.log('📊 市值前 20 股票:\n');
    finalPool.slice(0, 20).forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(2)}. ${s.tsCode.padEnd(10)} ${s.name.padEnd(8)} ${s.totalMv.toFixed(2).padStart(10)}亿`);
    });
}

main().catch(console.error);
