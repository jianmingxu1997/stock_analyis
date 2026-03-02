// 最终股票池筛选 + 板块统计
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-simple.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final.json');

/**
 * 从东财获取股票基本信息（市值、上市日期、板块）
 */
async function getStockInfo(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f12,f14,f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65,f66,f67,f68,f69,f70,f71,f72,f73,f74,f75,f76,f77,f78,f79,f80,f81,f82,f83,f84,f85,f86,f87,f88,f89,f90,f91,f92,f93,f94,f95,f96,f97,f98,f99,f100,f101,f102,f103,f104,f105,f106,f107,f108,f109,f110,f111,f112,f113,f114,f115,f116,f117,f118,f119,f120,f121,f122,f123,f124,f125,f126,f127,f128,f129,f130,f131,f132,f133,f134,f135,f136,f137,f138,f139,f140,f141,f142,f143,f144,f145,f146,f147,f148,f149,f150,f151,f152,f153,f154,f155,f156,f157,f158,f159,f160,f161,f162,f163,f164,f165,f166,f167,f168,f169,f170,f171,f172,f173,f174,f175,f176,f177,f178,f179,f180,f181,f182,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193,f194,f195,f196,f197,f198,f199,f200`;
        
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
            industry: d.f9 || 'N/A',              // 行业
            area: d.f190 || 'N/A',                // 地区
            totalMv: (d.f116 || 0) / 100000000,   // 总市值 (亿元)
            floatMv: (d.f117 || 0) / 100000000,   // 流通市值 (亿元)
            listDays: d.f161 || 0,                // 上市天数
            peTtm: (d.f162 || 0) / 100,           // PE(TTM)
            pb: (d.f165 || 0) / 100,              // PB
        };
        
    } catch (error) {
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  最终股票池筛选 + 板块统计');
    console.log('========================================\n');
    
    // 读取初步筛选结果
    console.log('📖 读取股票池...\n');
    const poolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = poolData.stockPool;
    
    console.log(`✅ 读取到 ${stocks.length} 只股票\n`);
    
    // 筛选规则
    const rules = {
        minMarketCap: 100,    // 最小市值 100 亿
        minListDays: 180      // 上市至少 180 天
    };
    
    console.log('📋 筛选规则:\n');
    console.log(`  ✅ 最小市值：≥${rules.minMarketCap}亿元`);
    console.log(`  ✅ 上市天数：≥${rules.minListDays}天\n`);
    
    const finalPool = [];
    const excluded = {
        smallCap: 0,
        newList: 0,
        other: 0
    };
    
    const industryStats = {};
    const areaStats = {};
    const marketCapRanges = {
        '100-200 亿': 0,
        '200-500 亿': 0,
        '500-1000 亿': 0,
        '1000-2000 亿': 0,
        '2000 亿+': 0
    };
    
    console.log('🔍 开始筛选并获取信息...\n');
    
    // 分批获取（避免限流）
    const batchSize = 50;
    const batches = Math.ceil(stocks.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const batch = stocks.slice(i * batchSize, (i + 1) * batchSize);
        const promises = batch.map(async (stock) => {
            const info = await getStockInfo(stock.tsCode);
            
            if (!info) {
                excluded.other++;
                return null;
            }
            
            // 筛选
            if (info.totalMv < rules.minMarketCap) {
                excluded.smallCap++;
                return null;
            }
            
            if (info.listDays < rules.minListDays) {
                excluded.newList++;
                return null;
            }
            
            // 统计板块
            const industry = info.industry;
            const area = info.area;
            
            industryStats[industry] = (industryStats[industry] || 0) + 1;
            areaStats[area] = (areaStats[area] || 0) + 1;
            
            // 市值区间统计
            if (info.totalMv < 200) {
                marketCapRanges['100-200 亿']++;
            } else if (info.totalMv < 500) {
                marketCapRanges['200-500 亿']++;
            } else if (info.totalMv < 1000) {
                marketCapRanges['500-1000 亿']++;
            } else if (info.totalMv < 2000) {
                marketCapRanges['1000-2000 亿']++;
            } else {
                marketCapRanges['2000 亿+']++;
            }
            
            return {
                ...stock,
                name: info.name,
                industry: info.industry,
                area: info.area,
                totalMv: info.totalMv,
                floatMv: info.floatMv,
                listDays: info.listDays,
                peTtm: info.peTtm,
                pb: info.pb
            };
        });
        
        const results = await Promise.all(promises);
        finalPool.push(...results.filter(r => r !== null));
        
        // 显示进度
        const current = Math.min((i + 1) * batchSize, stocks.length);
        console.log(`   进度：${current}/${stocks.length} 已筛选：${finalPool.length} 只`);
        
        // 限流保护
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n========================================');
    console.log('  筛选结果');
    console.log('========================================\n');
    
    console.log(`初步筛选：${stocks.length}只`);
    console.log(`最终股票池：${finalPool.length}只`);
    console.log(`排除股票数：${stocks.length - finalPool.length}只`);
    console.log(`保留比例：${(finalPool.length / stocks.length * 100).toFixed(1)}%\n`);
    
    console.log('排除原因统计:\n');
    console.log(`  市值<100 亿：${excluded.smallCap}`);
    console.log(`  上市<180 天：${excluded.newList}`);
    console.log(`  其他：${excluded.other}\n`);
    
    // 板块统计
    console.log('========================================');
    console.log('  板块分布统计');
    console.log('========================================\n');
    
    console.log('📊 行业分布（前 20）:\n');
    console.log('排名 | 行业              | 股票数 | 占比');
    console.log('-----|------------------|--------|------');
    
    const sortedIndustries = Object.entries(industryStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    
    sortedIndustries.forEach(([industry, count], i) => {
        const percent = (count / finalPool.length * 100).toFixed(1);
        console.log(`${(i+1).toString().padStart(4)} | ${industry.padEnd(16)} | ${count.toString().padStart(6)} | ${percent.padStart(5)}%`);
    });
    
    console.log('\n📊 地区分布（前 10）:\n');
    console.log('排名 | 地区    | 股票数 | 占比');
    console.log('-----|---------|--------|------');
    
    const sortedAreas = Object.entries(areaStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    sortedAreas.forEach(([area, count], i) => {
        const percent = (count / finalPool.length * 100).toFixed(1);
        console.log(`${(i+1).toString().padStart(4)} | ${area.padEnd(7)} | ${count.toString().padStart(6)} | ${percent.padStart(5)}%`);
    });
    
    console.log('\n📊 市值区间分布:\n');
    console.log('区间          | 股票数 | 占比');
    console.log('-------------|--------|------');
    
    Object.entries(marketCapRanges).forEach(([range, count]) => {
        const percent = (count / finalPool.length * 100).toFixed(1);
        console.log(`${range.padEnd(12)} | ${count.toString().padStart(6)} | ${percent.padStart(5)}%`);
    });
    
    // 保存结果
    const result = {
        filterDate: new Date().toISOString(),
        rules,
        stats: {
            initial: stocks.length,
            final: finalPool.length,
            excluded: stocks.length - finalPool.length
        },
        excludedReasons: excluded,
        industryDistribution: industryStats,
        areaDistribution: areaStats,
        marketCapDistribution: marketCapRanges,
        stockPool: finalPool.sort((a, b) => b.totalMv - a.totalMv)
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示市值前 20
    console.log('========================================');
    console.log('  市值前 20 股票');
    console.log('========================================\n');
    console.log('排名 | 代码       | 名称     | 价格   | 市值 (亿) | 行业');
    console.log('-----|------------|----------|--------|-----------|------------------');
    
    finalPool.sort((a, b) => b.totalMv - a.totalMv).slice(0, 20).forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.latestClose.toFixed(2).padStart(6)} | ${s.totalMv.toFixed(2).padStart(9)} | ${s.industry}`);
    });
    
    console.log('\n========================================\n');
}

main().catch(console.error);
