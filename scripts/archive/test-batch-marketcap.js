// 测试 Tushare 和 AKShare 全量市值数据
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-simple.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final-from-tushare.json');

const TUSHARE_TOKEN = 'ee8524fdaa2ee318cbb578e42b4eaaecdad6af533b6dc7d4200c4e6a';
const TUSHARE_API = 'http://api.tushare.pro';

/**
 * 方法 1: Tushare 全量市值数据
 */
async function getMarketCapFromTushare() {
    console.log('📊 测试 Tushare 全量市值数据...\n');
    
    try {
        // 获取全 A 股市值数据
        const response = await axios.post(TUSHARE_API, {
            api_name: 'daily_basic',
            token: TUSHARE_TOKEN,
            params: {
                trade_date: '20260227'
            }
        });
        
        if (response.data.code !== 0) {
            console.log(`❌ Tushare 失败：${response.data.msg}\n`);
            return null;
        }
        
        const data = response.data.data;
        const fields = data.fields;
        const items = data.items;
        
        console.log(`✅ Tushare 成功！获取到 ${items.length} 条记录\n`);
        
        // 转换为字典
        const marketCapMap = {};
        items.forEach(item => {
            const row = {};
            fields.forEach((f, i) => row[f] = item[i]);
            
            marketCapMap[row.ts_code] = {
                totalMv: row.total_mv / 10000,  // 万转亿
                floatMv: row.circ_mv / 10000,
                turnoverRatio: row.turnover_ratio,
                pe: row.pe,
                pb: row.pb
            };
        });
        
        return marketCapMap;
        
    } catch (error) {
        console.log(`❌ Tushare 异常：${error.message}\n`);
        return null;
    }
}

/**
 * 方法 2: AKShare (需要通过 Python 调用)
 */
async function getMarketCapFromAKShare() {
    console.log('📊 测试 AKShare 全量市值数据...\n');
    console.log('⚠️ AKShare 需要 Python 环境，暂时跳过\n');
    return null;
}

/**
 * 方法 3: 东财批量接口（分页）
 */
async function getMarketCapFromEastmoney() {
    console.log('📊 测试东财批量市值数据（分页）...\n');
    
    try {
        const marketCapMap = {};
        let total = 0;
        
        // 沪深分页获取
        const markets = [
            { name: '沪市', fs: 'm:1+t:2,m:1+t:23' },
            { name: '深市', fs: 'm:0+t:6,m:0+t:80' }
        ];
        
        for (const market of markets) {
            console.log(`   获取${market.name}...`);
            
            let pn = 1;
            const pageSize = 500;
            
            while (true) {
                const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${pn}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&delt=1&f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23,f24,f25,f26,f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&fs=${market.fs}&fields=f12,f14,f20,f21,f45,f46,f48,f49,f57,f61,f116,f117`;
                
                const response = await axios.get(url, {
                    headers: {
                        'Referer': 'https://quote.eastmoney.com/',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 30000
                });
                
                if (!response.data.data || !response.data.data.diff) {
                    break;
                }
                
                const stocks = response.data.data.diff;
                stocks.forEach(s => {
                    const tsCode = `${s.f12}.${s.f13 === 0 ? 'SZ' : 'SH'}`;
                    // 尝试多个字段
                    const totalMv = s.f116 || s.f20 || 0;
                    marketCapMap[tsCode] = {
                        name: s.f14,
                        totalMv: totalMv / 100000000,
                        floatMv: (s.f117 || s.f21 || 0) / 100000000,
                        pe: s.f9,
                        pb: s.f16,
                        raw_f116: s.f116,
                        raw_f20: s.f20
                    };
                });
                
                total += stocks.length;
                console.log(`      第${pn}页：${stocks.length}只 (累计${total}只)`);
                
                if (stocks.length < pageSize) break;
                pn++;
                if (pn > 20) break; // 限制最多 20 页，避免时间太长
                
                // 避免限流
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        console.log(`\n✅ 东财批量成功！获取到 ${total} 只股票\n`);
        return marketCapMap;
        
    } catch (error) {
        console.log(`❌ 东财批量异常：${error.message}\n`);
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  测试全量市值数据获取');
    console.log('========================================\n');
    
    // 读取股票池
    const poolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = poolData.stockPool;
    console.log(`📖 股票池：${stocks.length}只\n`);
    
    // 测试各数据源
    let marketCapData = null;
    
    // 1. 测试 Tushare
    marketCapData = await getMarketCapFromTushare();
    
    // 2. 如果 Tushare 失败，测试东财批量
    if (!marketCapData) {
        marketCapData = await getMarketCapFromEastmoney();
    }
    
    if (!marketCapData) {
        console.log('❌ 所有数据源都失败了\n');
        return;
    }
    
    // 筛选
    console.log('🔍 开始筛选...\n');
    
    const rules = { minMarketCap: 100, minListDays: 180 };
    const finalPool = [];
    const excluded = { smallCap: 0, other: 0 };
    
    for (const stock of stocks) {
        const info = marketCapData[stock.tsCode];
        
        if (!info) {
            excluded.other++;
            continue;
        }
        
        if (info.totalMv < rules.minMarketCap) {
            excluded.smallCap++;
            continue;
        }
        
        finalPool.push({
            ...stock,
            ...info
        });
    }
    
    console.log('\n========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    console.log(`原始股票：${stocks.length}只`);
    console.log(`最终股票池：${finalPool.length}只`);
    console.log(`排除：${stocks.length - finalPool.length}只\n`);
    
    console.log('排除原因:');
    console.log(`  市值<100 亿：${excluded.smallCap}`);
    console.log(`  无数据：${excluded.other}\n`);
    
    // 保存
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: {
            initial: stocks.length,
            final: finalPool.length,
            excluded: stocks.length - finalPool.length
        },
        excludedReasons: excluded,
        stockPool: finalPool.sort((a, b) => b.totalMv - a.totalMv)
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示前 20
    console.log('📊 市值前 20 股票:\n');
    console.log('排名 | 代码       | 名称     | 价格   | 市值 (亿) | PE');
    console.log('-----|------------|----------|--------|-----------|--------');
    
    finalPool.slice(0, 20).forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.latestClose.toFixed(2).padStart(6)} | ${s.totalMv.toFixed(2).padStart(9)} | ${s.pe?.toFixed(2) || 'N/A'}`);
    });
    
    console.log('\n========================================\n');
}

main().catch(console.error);
