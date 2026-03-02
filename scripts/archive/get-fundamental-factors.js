// 获取基本面因子数据
const axios = require('axios');

// Tushare 配置
const TUSHARE_TOKEN = 'ee8524fdaa2ee318cbb578e42b4eaaecdad6af533b6dc7d4200c4e6a';
const TUSHARE_API = 'http://api.tushare.pro';

/**
 * 调用 Tushare API
 */
async function callTushare(apiName, params = {}) {
    try {
        const response = await axios.post(TUSHARE_API, {
            api_name: apiName,
            token: TUSHARE_TOKEN,
            params
        });
        
        if (response.data.code !== 0) {
            throw new Error(response.data.msg);
        }
        
        return response.data.data;
    } catch (error) {
        console.error(`❌ ${apiName} 失败：${error.message}`);
        return null;
    }
}

/**
 * 获取股票基本信息
 */
async function getStockBasic(tsCode) {
    const data = await callTushare('stock_basic', { ts_code: tsCode });
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const fields = data.fields;
    const item = data.items[0];
    
    const stock = {};
    fields.forEach((f, i) => stock[f] = item[i]);
    
    return {
        tsCode: stock.ts_code,
        name: stock.name,
        industry: stock.industry,
        listDate: stock.list_date,
        totalShare: stock.total_share,      // 总股本 (万股)
        floatShare: stock.float_share,      // 流通股本 (万股)
        marketCap: stock.market_cap,        // 总市值 (亿元)
        floatMv: stock.float_mv             // 流通市值 (亿元)
    };
}

/**
 * 获取估值指标 (PE/PB/PS 等)
 */
async function getDailyBasic(tsCode, tradeDate) {
    const data = await callTushare('daily_basic', {
        ts_code: tsCode,
        trade_date: tradeDate
    });
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const fields = data.fields;
    const item = data.items[0];
    
    const basic = {};
    fields.forEach((f, i) => basic[f] = item[i]);
    
    return {
        tradeDate: basic.trade_date,
        pe: basic.pe,           // 市盈率
        peTtm: basic.pe_ttm,    // 市盈率 (TTM)
        pb: basic.pb,           // 市净率
        ps: basic.ps,           // 市销率
        dvRatio: basic.dv_ratio, // 股息率
        totalMv: basic.total_mv, // 总市值 (亿元)
        circMv: basic.circ_mv,   // 流通市值 (亿元)
        turnoverRatio: basic.turnover_ratio, // 换手率
        volumeRatio: basic.volume_ratio      // 量比
    };
}

/**
 * 获取财务指标 (ROE/毛利率/净利率等)
 */
async function getFinanceIndicator(tsCode) {
    const data = await callTushare('fina_indicator', { ts_code: tsCode });
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const fields = data.fields;
    // 取最新一期
    const item = data.items[0];
    
    const indicator = {};
    fields.forEach((f, i) => indicator[f] = item[i]);
    
    return {
        reportDate: indicator.ann_date,
        roe: indicator.roe,           // ROE
        roa: indicator.roa,           // ROA
        grossMargin: indicator.gross_margin, // 毛利率
        netProfitMargin: indicator.net_profit_margin, // 净利率
        currentRatio: indicator.current_ratio, // 流动比率
        quickRatio: indicator.quick_ratio,     // 速动比率
        debtToAsset: indicator.debt_to_assets, // 资产负债率
        eps: indicator.basic_eps    // 每股收益
    };
}

/**
 * 获取成长能力 (营收/净利润增长率)
 */
async function getGrowthData(tsCode) {
    const data = await callTushare('fina_indicator', { ts_code: tsCode });
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const fields = data.fields;
    const item = data.items[0];
    
    const growth = {};
    fields.forEach((f, i) => growth[f] = item[i]);
    
    return {
        reportDate: growth.ann_date,
        revGrowth: growth.rev_yoy,      // 营收增长率
        profitGrowth: growth.op_profit_yoy, // 营业利润增长率
        netProfitGrowth: growth.netprofit_yoy, // 净利润增长率
        totalAssetGrowth: growth.total_assets_yoy // 总资产增长率
    };
}

/**
 * 获取资金流向 (东财 API)
 */
async function getCapitalFlow(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get?
            lmt=0
            &klt=1
            &fields1=f1,f2,f3,f7
            &fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65
            &secid=${secid}`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (!response.data.data || !response.data.data.klines) {
            return null;
        }
        
        const latest = response.data.data.klines[0];
        const parts = latest.split(',');
        
        return {
            date: parts[0],
            mainNetInflow: parseFloat(parts[1]),    // 主力净流入 (万元)
            smallNetInflow: parseFloat(parts[2]),   // 小单净流入
            mediumNetInflow: parseFloat(parts[3]),  // 中单净流入
            bigNetInflow: parseFloat(parts[4]),     // 大单净流入
            superBigNetInflow: parseFloat(parts[5]) // 超大单净流入
        };
    } catch (error) {
        console.error(`❌ 资金流向获取失败：${error.message}`);
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  基本面因子获取');
    console.log('========================================\n');
    
    const stocks = [
        { code: '002046.SZ', name: '国机精工' },
        { code: '002270.SZ', name: '华明装备' }
    ];
    
    const results = {};
    
    for (const { code, name } of stocks) {
        console.log(`📊 分析 ${name} (${code})...\n`);
        
        // 1. 股票基本信息
        console.log('   📋 获取基本信息...');
        const stockBasic = await getStockBasic(code);
        
        // 2. 估值指标
        console.log('   💰 获取估值指标...');
        const dailyBasic = await getDailyBasic(code, '20260227');
        
        // 3. 财务指标
        console.log('   📈 获取财务指标...');
        const finance = await getFinanceIndicator(code);
        
        // 4. 成长能力
        console.log('   🚀 获取成长能力...');
        const growth = await getGrowthData(code);
        
        // 5. 资金流向
        console.log('   💵 获取资金流向...');
        const capitalFlow = await getCapitalFlow(code);
        
        results[code] = {
            name,
            code,
            stockBasic,
            dailyBasic,
            finance,
            growth,
            capitalFlow
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
    if (s1.stockBasic && s2.stockBasic) {
        console.log(`行业             | ${s1.stockBasic.industry.padEnd(16)} | ${s2.stockBasic.industry}`);
        console.log(`总市值 (亿元)     | ${String(s1.stockBasic.marketCap).padEnd(16)} | ${s2.stockBasic.marketCap}`);
        console.log(`流通市值 (亿元)   | ${String(s1.stockBasic.floatMv).padEnd(16)} | ${s2.stockBasic.floatMv}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 估值指标
    if (s1.dailyBasic && s2.dailyBasic) {
        console.log(`PE(TTM)          | ${String(s1.dailyBasic.peTtm).padEnd(16)} | ${s2.dailyBasic.peTtm}`);
        console.log(`PB               | ${String(s1.dailyBasic.pb).padEnd(16)} | ${s2.dailyBasic.pb}`);
        console.log(`PS               | ${String(s1.dailyBasic.ps).padEnd(16)} | ${s2.dailyBasic.ps}`);
        console.log(`股息率 (%)       | ${String(s1.dailyBasic.dvRatio).padEnd(16)} | ${s2.dailyBasic.dvRatio}`);
        console.log(`换手率 (%)       | ${String(s1.dailyBasic.turnoverRatio).padEnd(16)} | ${s2.dailyBasic.turnoverRatio}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 财务指标
    if (s1.finance && s2.finance) {
        console.log(`ROE(%)           | ${String(s1.finance.roe).padEnd(16)} | ${s2.finance.roe}`);
        console.log(`ROA(%)           | ${String(s1.finance.roa).padEnd(16)} | ${s2.finance.roa}`);
        console.log(`毛利率 (%)       | ${String(s1.finance.grossMargin).padEnd(16)} | ${s2.finance.grossMargin}`);
        console.log(`净利率 (%)       | ${String(s1.finance.netProfitMargin).padEnd(16)} | ${s2.finance.netProfitMargin}`);
        console.log(`资产负债率 (%)   | ${String(s1.finance.debtToAsset).padEnd(16)} | ${s2.finance.debtToAsset}`);
    }
    console.log('-----------------|------------------|------------------');
    
    // 成长能力
    if (s1.growth && s2.growth) {
        console.log(`营收增长率 (%)   | ${String(s1.growth.revGrowth).padEnd(16)} | ${s2.growth.revGrowth}`);
        console.log(`净利润增长率 (%) | ${String(s1.growth.netProfitGrowth).padEnd(16)} | ${s2.growth.netProfitGrowth}`);
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
    const outputFile = path.join(__dirname, 'fundamental-factors.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`📁 详细结果已保存到：${outputFile}\n`);
}

main().catch(console.error);
