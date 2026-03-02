// 批量获取股票池资金流向数据
const fs = require('fs');
const path = require('path');
const eastmoney = require('./eastmoney-api');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-with-factors.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-with-capital-flow.json');

async function main() {
    console.log('========================================');
    console.log('  批量获取资金流向数据');
    console.log('========================================\n');
    
    // 读取股票池
    console.log('📖 读取股票池...');
    const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = data.stockPool;
    console.log(`✅ 股票池：${stocks.length}只\n`);
    
    // 批量获取资金流向
    const flowData = await eastmoney.getBatchFlow(
        stocks.map(s => s.tsCode),
        300  // 300ms 间隔，避免限流
    );
    
    // 合并数据
    console.log('🔗 合并资金流向数据到股票池...\n');
    
    let matched = 0;
    let noFlow = 0;
    
    stocks.forEach(stock => {
        const flow = flowData[stock.tsCode];
        
        if (flow) {
            matched++;
            stock.capitalFlow = {
                date: flow.date,
                mainNetInflow: flow.mainNetInflow,      // 主力净流入 (万元)
                smallNetInflow: flow.smallNetInflow,     // 小单净流入 (万元)
                mediumNetInflow: flow.mediumNetInflow,   // 中单净流入 (万元)
                bigNetInflow: flow.bigNetInflow,         // 大单净流入 (万元)
                superBigNetInflow: flow.superBigNetInflow // 超大单净流入 (万元)
            };
        } else {
            noFlow++;
            stock.capitalFlow = null;
        }
    });
    
    console.log(`✅ 匹配成功：${matched}只`);
    console.log(`⚠️ 无数据：${noFlow}只`);
    console.log(`📊 匹配率：${(matched / stocks.length * 100).toFixed(1)}%\n`);
    
    // 保存结果
    const result = {
        ...data,
        capitalFlowDate: new Date().toISOString(),
        stats: {
            ...data.stats,
            withCapitalFlow: matched,
            withoutCapitalFlow: noFlow
        }
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
    console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);
    
    // 显示示例
    console.log('📊 资金流向 Top 10（主力净流入）:\n');
    
    const sorted = stocks
        .filter(s => s.capitalFlow)
        .sort((a, b) => b.capitalFlow.mainNetInflow - a.capitalFlow.mainNetInflow)
        .slice(0, 10);
    
    sorted.forEach((s, i) => {
        const inflow = s.capitalFlow.mainNetInflow;
        const inflowStr = inflow > 0 ? `+${(inflow/10000).toFixed(2)}亿` : `${(inflow/10000).toFixed(2)}亿`;
        console.log(`${(i+1).toString().padStart(2)}. ${s.tsCode.padEnd(10)} ${s.name.padEnd(8)} ${inflowStr.padStart(12)}`);
    });
    
    console.log('\n========================================');
    console.log('  完成！');
    console.log('========================================\n');
    
    console.log('✅ 现在股票池包含：');
    console.log('   - 技术面因子：16 个');
    console.log('   - 基本面因子：4 个');
    console.log('   - 资金面因子：6 个 ⭐ 新增！');
    console.log('   - 市场面因子：3 个');
    console.log('   总计：29 个因子\n');
}

main().catch(console.error);
