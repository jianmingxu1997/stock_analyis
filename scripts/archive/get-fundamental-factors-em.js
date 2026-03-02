// 获取基本面因子数据 - 东方财富免费版
const axios = require('axios');

/**
 * 东财股票数据 API
 */
async function getEastmoneyQuote(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        // 东财实时行情接口（包含基本面数据）
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65,f66,f67,f68,f69,f70,f71,f72,f73,f74,f75,f76,f77,f78,f79,f80,f81,f82,f83,f84,f85,f86,f87,f88,f89,f90,f91,f92,f93,f94,f95,f96,f97,f98,f99,f100,f101,f102,f103,f104,f105,f106,f107,f108,f109,f110,f111,f112,f113,f114,f115,f116,f117,f118,f119,f120,f121,f122,f123,f124,f125,f126,f127,f128,f129,f130,f131,f132,f133,f134,f135,f136,f137,f138,f139,f140,f141,f142,f143,f144,f145,f146,f147,f148,f149,f150,f151,f152,f153,f154,f155,f156,f157,f158,f159,f160,f161,f162,f163,f164,f165,f166,f167,f168,f169,f170,f171,f172,f173,f174,f175,f176,f177,f178,f179,f180,f181,f182,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193,f194,f195,f196,f197,f198,f199,f200&ndays=1&iscrr=true`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        if (!response.data.data) {
            return null;
        }
        
        const d = response.data.data;
        
        return {
            // 基本信息
            code: d.f12,
            name: d.f14,
            industry: d.f9 || 'N/A',  // 行业名称
            area: d.f190 || 'N/A',
            
            // 价格
            price: d.f43 / 100,           // 现价
            change: d.f146 / 100,         // 涨跌额
            changePercent: d.f147 / 100,  // 涨跌幅
            high: d.f44 / 100,            // 最高
            low: d.f45 / 100,             // 最低
            open: d.f46 / 100,            // 开盘
            preClose: d.f60 / 100,        // 昨收
            
            // 市值 (元转亿元)
            totalMv: (d.f116 || 0) / 100000000,      // 总市值 (亿元)
            floatMv: (d.f117 || 0) / 100000000,      // 流通市值 (亿元)
            
            // 估值指标 (需要/100)
            pe: (d.f164 || 0) / 100,                   // 市盈率 (静)
            peTtm: (d.f162 || 0) / 100,                // 市盈率 (TTM)
            peDyn: (d.f163 || 0) / 100,                // 市盈率 (动)
            pb: (d.f165 || 0) / 100,                   // 市净率
            ps: (d.f167 || 0) / 100,                   // 市销率
            pcf: (d.f168 || 0) / 100,                  // 市现率
            
            // 股本 (股转万股)
            totalShares: (d.f84 || 0) / 10000,           // 总股本 (万股)
            floatShares: (d.f85 || 0) / 10000,           // 流通股本 (万股)
            
            // 交易数据
            volume: d.f47,                // 成交量 (手)
            amount: d.f48 / 10000,        // 成交额 (万元)
            turnoverRatio: d.f169,        // 换手率 (%)
            volumeRatio: d.f170,          // 量比
            
            // 股息 (需要/100)
            dvRatio: (d.f171 || 0) / 100,              // 股息率 (%)
            
            // 财务指标 (TTM)
            eps: d.f159,                  // 每股收益
            bvps: d.f160,                 // 每股净资产
            cfps: d.f172,                 // 每股现金流
            
            // 52 周
            week52High: d.f173 / 100,     // 52 周最高
            week52Low: d.f174 / 100,      // 52 周最低
        };
        
    } catch (error) {
        console.error(`❌ 获取 ${tsCode} 失败：${error.message}`);
        return null;
    }
}

/**
 * 获取资金流向
 */
async function getCapitalFlow(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=1&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&secid=${secid}`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });
        
        if (!response.data.data || !response.data.data.klines || response.data.data.klines.length === 0) {
            return null;
        }
        
        const latest = response.data.data.klines[0];
        const parts = latest.split(',');
        
        return {
            date: parts[0],
            mainNetInflow: parseFloat(parts[1]) / 10000,      // 主力净流入 (亿元)
            smallNetInflow: parseFloat(parts[2]) / 10000,     // 小单净流入 (亿元)
            mediumNetInflow: parseFloat(parts[3]) / 10000,    // 中单净流入 (亿元)
            bigNetInflow: parseFloat(parts[4]) / 10000,       // 大单净流入 (亿元)
            superBigNetInflow: parseFloat(parts[5]) / 10000   // 超大单净流入 (亿元)
        };
        
    } catch (error) {
        console.error(`❌ 资金流向获取失败：${error.message}`);
        return null;
    }
}

/**
 * 获取财务指标 (从东财 F10)
 */
async function getFinancials(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        // 财务指标暂时返回 null，从估值数据推算
        return {
            note: '财务指标需从 F10 页面获取，暂用估值数据推算',
            roe: 'N/A',
            roa: 'N/A',
            grossMargin: 'N/A',
            netMargin: 'N/A',
            debtToAsset: 'N/A',
            currentRatio: 'N/A',
            quickRatio: 'N/A',
            revGrowth: 'N/A',
            profitGrowth: 'N/A'
        };
        
    } catch (error) {
        console.error(`❌ 财务指标获取失败：${error.message}`);
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  基本面因子获取 (东方财富免费版)');
    console.log('========================================\n');
    
    const stocks = [
        { code: '002046.SZ', name: '国机精工' },
        { code: '002270.SZ', name: '华明装备' }
    ];
    
    const results = {};
    
    for (const { code, name } of stocks) {
        console.log(`📊 分析 ${name} (${code})...\n`);
        
        // 1. 实时行情 + 基本面
        console.log('   📋 获取实时行情及基本面...');
        const quote = await getEastmoneyQuote(code);
        
        // 2. 资金流向
        console.log('   💵 获取资金流向...');
        const capitalFlow = await getCapitalFlow(code);
        
        // 3. 财务指标
        console.log('   📈 获取财务指标...');
        const financials = await getFinancials(code);
        
        results[code] = {
            name,
            code,
            quote,
            capitalFlow,
            financials
        };
        
        console.log('');
    }
    
    // 输出对比
    console.log('\n========================================');
    console.log('  基本面因子对比');
    console.log('========================================\n');
    
    const s1 = results['002046.SZ'];
    const s2 = results['002270.SZ'];
    
    console.log('因子类别          | 国机精工          | 华明装备');
    console.log('-----------------|------------------|------------------');
    
    // 基本信息
    if (s1.quote && s2.quote) {
        console.log(`行业             | ${String(s1.quote.industry).padEnd(16)} | ${s2.quote.industry}`);
        console.log(`总市值 (亿元)     | ${String(s1.quote.totalMv).padEnd(16)} | ${s2.quote.totalMv}`);
        console.log(`流通市值 (亿元)   | ${String(s1.quote.floatMv).padEnd(16)} | ${s2.quote.floatMv}`);
        console.log(`总股本 (万股)    | ${String(s1.quote.totalShares).padEnd(16)} | ${s2.quote.totalShares}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 估值指标
    if (s1.quote && s2.quote) {
        console.log(`PE(TTM)          | ${String(s1.quote.peTtm).padEnd(16)} | ${s2.quote.peTtm}`);
        console.log(`PE(静)           | ${String(s1.quote.pe).padEnd(16)} | ${s2.quote.pe}`);
        console.log(`PE(动)           | ${String(s1.quote.peDyn).padEnd(16)} | ${s2.quote.peDyn}`);
        console.log(`PB               | ${String(s1.quote.pb).padEnd(16)} | ${s2.quote.pb}`);
        console.log(`PS               | ${String(s1.quote.ps).padEnd(16)} | ${s2.quote.ps}`);
        console.log(`PCF              | ${String(s1.quote.pcf).padEnd(16)} | ${s2.quote.pcf}`);
        console.log(`股息率 (%)       | ${String(s1.quote.dvRatio).padEnd(16)} | ${s2.quote.dvRatio}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 每股指标
    if (s1.quote && s2.quote) {
        console.log(`EPS(元)          | ${String(s1.quote.eps).padEnd(16)} | ${s2.quote.eps}`);
        console.log(`BVPS(元)         | ${String(s1.quote.bvps).padEnd(16)} | ${s2.quote.bvps}`);
        console.log(`CFPS(元)         | ${String(s1.quote.cfps).padEnd(16)} | ${s2.quote.cfps}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 财务指标
    if (s1.financials && s2.financials) {
        console.log(`ROE(%)           | ${String(s1.financials.roe).padEnd(16)} | ${s2.financials.roe}`);
        console.log(`ROA(%)           | ${String(s1.financials.roa).padEnd(16)} | ${s2.financials.roa}`);
        console.log(`毛利率 (%)       | ${String(s1.financials.grossMargin).padEnd(16)} | ${s2.financials.grossMargin}`);
        console.log(`净利率 (%)       | ${String(s1.financials.netMargin).padEnd(16)} | ${s2.financials.netMargin}`);
        console.log(`资产负债率 (%)   | ${String(s1.financials.debtToAsset).padEnd(16)} | ${s2.financials.debtToAsset}`);
        console.log(`流动比率         | ${String(s1.financials.currentRatio).padEnd(16)} | ${s2.financials.currentRatio}`);
        console.log(`速动比率         | ${String(s1.financials.quickRatio).padEnd(16)} | ${s2.financials.quickRatio}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 成长能力
    if (s1.financials && s2.financials) {
        console.log(`营收增长率 (%)   | ${String(s1.financials.revGrowth).padEnd(16)} | ${s2.financials.revGrowth}`);
        console.log(`净利润增长率 (%) | ${String(s1.financials.profitGrowth).padEnd(16)} | ${s2.financials.profitGrowth}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 资金流向
    if (s1.capitalFlow && s2.capitalFlow) {
        console.log(`主力净流入 (万元) | ${String(s1.capitalFlow.mainNetInflow).padEnd(16)} | ${s2.capitalFlow.mainNetInflow}`);
        console.log(`大单净流入 (万元) | ${String(s1.capitalFlow.bigNetInflow).padEnd(16)} | ${s2.capitalFlow.bigNetInflow}`);
        console.log(`超大单净流入 (万元)| ${String(s1.capitalFlow.superBigNetInflow).padEnd(16)} | ${s2.capitalFlow.superBigNetInflow}`);
    }
    
    console.log('\n========================================\n');
    
    // 保存结果
    const fs = require('fs');
    const path = require('path');
    const outputFile = path.join(__dirname, 'fundamental-factors-eastmoney.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`📁 详细结果已保存到：${outputFile}\n`);
}

main().catch(console.error);
