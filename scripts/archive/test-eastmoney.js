// 测试东财 API
const eastmoney = require('./eastmoney-api');

async function test() {
    console.log('========================================');
    console.log('  测试东财 API');
    console.log('========================================\n');
    
    // 测试 1：单个股票资金流向
    console.log('📊 测试 1：获取中国核建资金流向...\n');
    const flow = await eastmoney.getStockFlow('601611.SH');
    if (flow) {
        console.log('✅ 成功！\n');
        console.log(`   日期：${flow.date}`);
        console.log(`   主力净流入：${flow.mainNetInflow.toFixed(2)}万元`);
        console.log(`   大单净流入：${flow.bigNetInflow.toFixed(2)}万元`);
        console.log(`   超大单净流入：${flow.superBigNetInflow.toFixed(2)}万元`);
        console.log(`   中单净流入：${flow.mediumNetInflow.toFixed(2)}万元`);
        console.log(`   小单净流入：${flow.smallNetInflow.toFixed(2)}万元`);
    } else {
        console.log('❌ 失败\n');
    }
    console.log('');
    
    // 测试 2：板块资金流向
    console.log('📊 测试 2：获取行业资金流向...\n');
    const sectorFlow = await eastmoney.getSectorFlow('industry');
    if (sectorFlow.length > 0) {
        console.log(`✅ 成功！获取到 ${sectorFlow.length} 个行业\n`);
        console.log('   前 10 行业:\n');
        sectorFlow.slice(0, 10).forEach((s, i) => {
            console.log(`   ${i+1}. ${s.name.padEnd(12)} 主力净流入：${(s.mainNetInflow/10000).toFixed(2)}亿`);
        });
    } else {
        console.log('❌ 失败\n');
    }
    console.log('');
    
    // 测试 3：北向资金
    console.log('📊 测试 3：获取北向资金...\n');
    const northFlow = await eastmoney.getNorthFlow();
    if (northFlow) {
        console.log('✅ 成功！\n');
        console.log(`   沪股通：${(northFlow.shNorthInflow/10000).toFixed(2)}亿`);
        console.log(`   深股通：${(northFlow.szNorthInflow/10000).toFixed(2)}亿`);
        console.log(`   总计：${(northFlow.totalNorthInflow/10000).toFixed(2)}亿`);
    } else {
        console.log('❌ 失败\n');
    }
    console.log('');
    
    // 测试 4：批量获取（只测 5 只）
    console.log('📊 测试 4：批量获取资金流向（5 只）...\n');
    const testCodes = ['601611.SH', '601398.SH', '600519.SH', '000969.SZ', '002046.SZ'];
    const batchFlow = await eastmoney.getBatchFlow(testCodes, 500);
    
    console.log('   结果:\n');
    testCodes.forEach(code => {
        const flow = batchFlow[code];
        if (flow) {
            console.log(`   ✅ ${code}: 主力净流入 ${flow.mainNetInflow.toFixed(2)}万元`);
        } else {
            console.log(`   ❌ ${code}: 获取失败`);
        }
    });
    console.log('');
    
    console.log('========================================');
    console.log('  测试完成！');
    console.log('========================================\n');
}

test().catch(console.error);
