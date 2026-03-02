// 筛选可投资股票池
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool.json');

/**
 * 读取 CSV 文件（只读取表头和必要字段）
 */
function readStockList() {
    console.log('📖 读取股票列表...\n');
    
    // 从 sz_main.csv 读取深市主板
    const szPath = path.join(MERGED_DIR, 'sz_main.csv');
    const szContent = fs.readFileSync(szPath, 'utf8');
    const szLines = szContent.trim().split('\n');
    const szHeaders = szLines[0].split(',').map(h => h.trim());
    
    // 从 sh_main.csv 读取沪市主板
    const shPath = path.join(MERGED_DIR, 'sh_main.csv');
    const shContent = fs.readFileSync(shPath, 'utf8');
    const shLines = shContent.trim().split('\n');
    const shHeaders = shLines[0].split(',').map(h => h.trim());
    
    // 提取股票代码和最新数据
    const stocks = [];
    
    // 处理深市
    const tsCodeIdx = szHeaders.indexOf('ts_code');
    const tradeDateIdx = szHeaders.indexOf('trade_date');
    const closeIdx = szHeaders.indexOf('close');
    
    for (let i = 1; i < szLines.length; i++) {
        const values = szLines[i].split(',');
        const tsCode = values[tsCodeIdx];
        const tradeDate = values[tradeDateIdx];
        const close = parseFloat(values[closeIdx]);
        
        // 找到每只股票的最新数据
        const existing = stocks.find(s => s.tsCode === tsCode);
        if (!existing || tradeDate > existing.tradeDate) {
            stocks.push({
                tsCode,
                tradeDate,
                close,
                market: 'SZ'
            });
        }
    }
    
    // 处理沪市
    const shTsCodeIdx = shHeaders.indexOf('ts_code');
    const shTradeDateIdx = shHeaders.indexOf('trade_date');
    const shCloseIdx = shHeaders.indexOf('close');
    
    for (let i = 1; i < shLines.length; i++) {
        const values = shLines[i].split(',');
        const tsCode = values[shTsCodeIdx];
        const tradeDate = values[shTradeDateIdx];
        const close = parseFloat(values[shCloseIdx]);
        
        const existing = stocks.find(s => s.tsCode === tsCode);
        if (!existing || tradeDate > existing.tradeDate) {
            stocks.push({
                tsCode,
                tradeDate,
                close,
                market: 'SH'
            });
        }
    }
    
    console.log(`✅ 读取到 ${stocks.length} 条记录\n`);
    return stocks;
}

/**
 * 获取股票基本信息（用于筛选）
 */
async function getStockInfo(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f12,f14,f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65,f66,f67,f68,f69,f70,f71,f72,f73,f74,f75,f76,f77,f78,f79,f80,f81,f82,f83,f84,f85,f86,f87,f88,f89,f90,f91,f92,f93,f94,f95,f96,f97,f98,f99,f100,f101,f102,f103,f104,f105,f106,f107,f108,f109,f110,f111,f112,f113,f114,f115,f116,f117,f118,f119,f120,f121,f122,f123,f124,f125,f126,f127,f128,f129,f130,f131,f132,f133,f134,f135,f136,f137,f138,f139,f140,f141,f142,f143,f144,f145,f146,f147,f148,f149,f150,f151,f152,f153,f154,f155,f156,f157,f158,f159,f160,f161,f162,f163,f164,f165,f166,f167,f168,f169,f170,f171,f172,f173,f174,f175,f176,f177,f178,f179,f180,f181,f182,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193,f194,f195,f196,f197,f198,f199,f200`;
        
        const axios = require('axios');
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });
        
        if (!response.data.data) {
            return null;
        }
        
        const d = response.data.data;
        
        return {
            code: d.f12,
            name: d.f14,
            price: d.f43 / 100,
            changePercent: d.f147 / 100,
            totalMv: (d.f116 || 0) / 100000000,  // 总市值 (亿元)
            floatMv: (d.f117 || 0) / 100000000,  // 流通市值 (亿元)
            peTtm: (d.f162 || 0) / 100,
            pb: (d.f165 || 0) / 100,
            volume: d.f47,
            amount: (d.f48 || 0) / 10000,  // 成交额 (万元)
            turnoverRatio: (d.f169 || 0) / 100,
            
            // 用于筛选
            isST: d.f14.includes('ST'),
            listDays: d.f161 || 0,  // 上市天数
        };
        
    } catch (error) {
        return null;
    }
}

/**
 * 筛选股票池
 */
async function filterStockPool() {
    console.log('========================================');
    console.log('  股票池筛选');
    console.log('========================================\n');
    
    // 读取股票列表
    const stocks = readStockList();
    
    // 筛选规则
    const rules = {
        excludeST: true,              // 排除 ST
        excludeChiNext: true,         // 排除创业板 (300/301)
        excludeStar: true,            // 排除科创板 (688/689)
        excludeBSE: true,             // 排除北交所 (4/8/920)
        minMarketCap: 100,            // 最小市值 100 亿
        minListDays: 180,             // 上市至少 180 天
        // 不限制成交额和 PE，避免错过好股票
        // minAmount: 10000,          // ❌ 不限制
        // maxPE: 200,                // ❌ 不限制
        // excludeLoss: true          // ❌ 不限制
    };
    
    console.log('📋 筛选规则:\n');
    console.log(`  ✅ 排除 ST 股票`);
    console.log(`  ✅ 排除创业板 (300/301 开头)`);
    console.log(`  ✅ 排除科创板 (688/689 开头)`);
    console.log(`  ✅ 排除北交所 (4/8/920 开头)`);
    console.log(`  ✅ 最小市值：${rules.minMarketCap}亿元`);
    console.log(`  ✅ 上市天数：>${rules.minListDays}天`);
    console.log(`  ℹ️  不限制成交额（避免错过好股票）`);
    console.log(`  ℹ️  不限制 PE（避免错过周期股/成长股）`);
    console.log('\n');
    
    const pool = [];
    const excluded = {
        ST: 0,
        ChiNext: 0,
        Star: 0,
        BSE: 0,
        SmallCap: 0,
        NewStock: 0,
        LowLiquidity: 0,
        HighPE: 0,
        Loss: 0,
        Other: 0
    };
    
    console.log('🔍 开始筛选...\n');
    
    // 分批获取信息（避免限流）
    const batchSize = 50;
    const batches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const batch = stocks.slice(i * batchSize, (i + 1) * batchSize);
        const promises = batch.map(async (stock) => {
            const info = await getStockInfo(stock.tsCode);
            
            if (!info) {
                excluded.Other++;
                return null;
            }
            
            // 应用筛选规则
            if (info.isST) {
                excluded.ST++;
                return null;
            }
            
            const code = stock.tsCode.split('.')[0];
            if (code.startsWith('300') || code.startsWith('301')) {
                excluded.ChiNext++;
                return null;
            }
            
            if (code.startsWith('688') || code.startsWith('689')) {
                excluded.Star++;
                return null;
            }
            
            if (code.startsWith('4') || code.startsWith('8') || code.startsWith('920')) {
                excluded.BSE++;
                return null;
            }
            
            if (info.totalMv < rules.minMarketCap) {
                excluded.SmallCap++;
                return null;
            }
            
            if (info.listDays < rules.minListDays) {
                excluded.NewStock++;
                return null;
            }
            
            // 不限制成交额和 PE，避免错过好股票
            // if (info.amount < rules.minAmount) {
            //     excluded.LowLiquidity++;
            //     return null;
            // }
            
            // if (info.peTtm > rules.maxPE || (rules.excludeLoss && info.peTtm < 0)) {
            //     if (info.peTtm < 0) {
            //         excluded.Loss++;
            //     } else {
            //         excluded.HighPE++;
            //     }
            //     return null;
            // }
            
            return {
                tsCode: stock.tsCode,
                name: info.name,
                market: stock.market,
                code,
                price: info.price,
                changePercent: info.changePercent,
                totalMv: info.totalMv,
                floatMv: info.floatMv,
                peTtm: info.peTtm,
                pb: info.pb,
                volume: info.volume,
                amount: info.amount,
                turnoverRatio: info.turnoverRatio,
                listDays: info.listDays
            };
        });
        
        const results = await Promise.all(promises);
        pool.push(...results.filter(r => r !== null));
        
        // 显示进度
        const current = Math.min((i + 1) * batchSize, stocks.length);
        console.log(`   进度：${current}/${stocks.length} 已筛选：${pool.length} 只`);
        
        // 限流保护
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    console.log(`原始股票数：${stocks.length}`);
    console.log(`筛选后股票数：${pool.length}`);
    console.log(`排除股票数：${stocks.length - pool.length}`);
    console.log(`筛选比例：${(pool.length / stocks.length * 100).toFixed(1)}%\n`);
    
    console.log('排除原因统计:\n');
    console.log(`  ST 股票：${excluded.ST}`);
    console.log(`  创业板：${excluded.ChiNext}`);
    console.log(`  科创板：${excluded.Star}`);
    console.log(`  北交所：${excluded.BSE}`);
    console.log(`  市值<100 亿：${excluded.SmallCap}`);
    console.log(`  上市<180 天：${excluded.NewStock}`);
    console.log(`  成交额<1 亿：${excluded.LowLiquidity}`);
    console.log(`  PE>200：${excluded.HighPE}`);
    console.log(`  亏损：${excluded.Loss}`);
    console.log(`  其他：${excluded.Other}\n`);
    
    // 按市值排序
    pool.sort((a, b) => b.totalMv - a.totalMv);
    
    // 保存结果
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: {
            original: stocks.length,
            filtered: pool.length,
            excluded: stocks.length - pool.length
        },
        excludedReasons: excluded,
        stockPool: pool
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示前 20 只
    console.log('📊 市值前 20 只股票:\n');
    console.log('排名 | 代码       | 名称     | 价格   | 市值 (亿) | PE(TTM) | 涨幅 (%)');
    console.log('-----|------------|----------|--------|-----------|---------|--------');
    
    pool.slice(0, 20).forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.price.toFixed(2).padStart(6)} | ${s.totalMv.toFixed(2).padStart(9)} | ${s.peTtm.toFixed(2).padStart(7)} | ${s.changePercent.toFixed(2).padStart(6)}`);
    });
    
    console.log('\n========================================\n');
    
    return pool;
}

filterStockPool().catch(console.error);
