// 最终股票池筛选 - 稳健版（低并发 + 重试）
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-simple.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final.json');

/**
 * 从东财获取股票基本信息（带重试）
 */
async function getStockInfo(tsCode, retry = 3) {
    for (let i = 0; i < retry; i++) {
        try {
            const code = tsCode.split('.')[0];
            const market = tsCode.split('.')[1];
            const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
            
            // 简化字段，只获取必要的
            const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f9,f116,f117,f161,f162,f165`;
            
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'https://quote.eastmoney.com/',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000
            });
            
            if (!response.data.data) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            
            const d = response.data.data;
            
            return {
                industry: d.f9 || 'N/A',
                totalMv: (d.f116 || 0) / 100000000,
                floatMv: (d.f117 || 0) / 100000000,
                listDays: d.f161 || 0,
                peTtm: (d.f162 || 0) / 100,
                pb: (d.f165 || 0) / 100
            };
            
        } catch (error) {
            if (i < retry - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    return null;
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  最终股票池筛选（稳健版）');
    console.log('========================================\n');
    
    const poolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = poolData.stockPool;
    
    console.log(`📖 读取到 ${stocks.length} 只股票\n`);
    
    const rules = { minMarketCap: 100, minListDays: 180 };
    
    console.log('📋 筛选规则:');
    console.log(`  ✅ 最小市值：≥${rules.minMarketCap}亿元`);
    console.log(`  ✅ 上市天数：≥${rules.minListDays}天\n`);
    
    const finalPool = [];
    const excluded = { smallCap: 0, newList: 0, other: 0 };
    const industryStats = {};
    
    console.log('🔍 开始筛选...\n');
    
    // 低并发 + 慢速
    const batchSize = 10;
    const batches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const batch = stocks.slice(i * batchSize, (i + 1) * batchSize);
        
        for (const stock of batch) {
            const info = await getStockInfo(stock.tsCode);
            
            if (!info) {
                excluded.other++;
                continue;
            }
            
            if (info.totalMv < rules.minMarketCap) {
                excluded.smallCap++;
                continue;
            }
            
            if (info.listDays < rules.minListDays) {
                excluded.newList++;
                continue;
            }
            
            industryStats[info.industry] = (industryStats[info.industry] || 0) + 1;
            
            finalPool.push({
                ...stock,
                ...info
            });
        }
        
        const current = Math.min((i + 1) * batchSize, stocks.length);
        const percent = ((current / stocks.length) * 100).toFixed(1);
        console.log(`   进度：${percent}% (${current}/${stocks.length}) 已筛选：${finalPool.length}只`);
        
        // 每批后暂停
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    console.log(`初步筛选：${stocks.length}只`);
    console.log(`最终股票池：${finalPool.length}只`);
    console.log(`排除股票数：${stocks.length - finalPool.length}只\n`);
    
    console.log('排除原因:');
    console.log(`  市值<100 亿：${excluded.smallCap}`);
    console.log(`  上市<180 天：${excluded.newList}`);
    console.log(`  其他：${excluded.other}\n`);
    
    if (finalPool.length > 0) {
        console.log('📊 行业分布（前 10）:\n');
        const sorted = Object.entries(industryStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
        sorted.forEach(([ind, count], i) => {
            console.log(`${(i+1).toString().padStart(2)}. ${ind.padEnd(15)} ${count}只 (${(count/finalPool.length*100).toFixed(1)}%)`);
        });
    }
    
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: { initial: stocks.length, final: finalPool.length, excluded: stocks.length - finalPool.length },
        excludedReasons: excluded,
        industryDistribution: industryStats,
        stockPool: finalPool.sort((a, b) => b.totalMv - a.totalMv)
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n📁 结果已保存到：${OUTPUT_FILE}\n`);
}

main().catch(console.error);
