/**
 * 完整的新浪 API 交互测试
 * 展示从 API 获取到写入 CSV 的完整流程
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const TEST_STOCK = '600000.SH';

async function testFullFlow() {
    console.log('========================================');
    console.log('  完整 API 交互测试');
    console.log('========================================\n');
    
    // 步骤 1: 调用新浪 API
    console.log('[步骤 1] 调用新浪 API...');
    const code = TEST_STOCK.split('.')[0];
    const market = TEST_STOCK.split('.')[1].toLowerCase();
    const sinaCode = market + code;
    
    const url = `https://hq.sinajs.cn/list=${sinaCode}`;
    console.log('URL:', url);
    
    const response = await axios.get(url, {
        headers: {
            'Referer': 'https://finance.sina.com.cn/',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    });
    
    console.log('原始返回:', response.data);
    console.log('');
    
    // 步骤 2: 解析数据
    console.log('[步骤 2] 解析数据...');
    const match = response.data.match(/="([^"]+)"/);
    if (!match) {
        console.log('❌ 解析失败！');
        return;
    }
    
    const fields = match[1].split(',');
    console.log('字段总数:', fields.length);
    console.log('');
    
    console.log('关键字段:');
    console.log('  [0] 股票名:', fields[0]);
    console.log('  [1] 开盘:', fields[1]);
    console.log('  [2] 昨收:', fields[2]);
    console.log('  [3] 当前价:', fields[3]);
    console.log('  [4] 最高:', fields[4]);
    console.log('  [5] 最低:', fields[5]);
    console.log('  [8] 成交量 (手):', fields[8]);
    console.log('  [9] 成交额 (元):', fields[9]);
    console.log('  [30] 日期:', fields[30]);
    console.log('  [31] 时间:', fields[31]);
    console.log('');
    
    // 步骤 3: 转换数据
    console.log('[步骤 3] 转换数据...');
    const apiDate = fields[30] ? fields[30].replace(/-/g, '') : 'unknown';
    const data = {
        ts_code: TEST_STOCK,
        trade_date: apiDate,
        open: parseFloat(fields[1]) || 0,
        high: parseFloat(fields[4]) || 0,
        low: parseFloat(fields[5]) || 0,
        close: parseFloat(fields[3]) || 0,
        pre_close: parseFloat(fields[2]) || 0,
        change: (parseFloat(fields[3]) - parseFloat(fields[2])) || 0,
        pct_chg: ((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2]) * 100) || 0,
        vol: parseFloat(fields[8]) || 0,
        amount: parseFloat(fields[9]) / 10000
    };
    
    console.log('转换后的数据:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // 步骤 4: 检查 CSV 现有数据
    console.log('[步骤 4] 检查 CSV 现有数据...');
    const csvFile = path.join(MERGED_DIR, 'sh_main.csv');
    const content = fs.readFileSync(csvFile, 'utf8');
    const lines = content.trim().split('\n');
    
    console.log('CSV 总行数:', lines.length);
    
    const existingDates = new Set();
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
        const fields = lines[i].split(',');
        if (fields.length > 1) {
            existingDates.add(fields[1]);
        }
    }
    
    console.log('CSV 里已有的日期 (前 10 个):');
    Array.from(existingDates).slice(0, 10).forEach(d => {
        console.log('  ', d);
    });
    console.log('');
    
    // 步骤 5: 检查是否会写入
    console.log('[步骤 5] 检查是否会写入...');
    console.log('API 返回的日期:', apiDate);
    console.log('CSV 最新日期:', Array.from(existingDates)[0]);
    
    const shouldWrite = !existingDates.has(apiDate);
    console.log('是否应该写入:', shouldWrite ? '✅ 是' : '❌ 否');
    console.log('');
    
    if (!shouldWrite) {
        console.log('❌ 问题：CSV 里已经有这个日期了！');
        console.log('   但理论上 CSV 里最新是 20260227，API 返回是 20260302');
        console.log('   请检查 fields[30] 是否真的是日期字段');
    } else {
        console.log('✅ 数据应该会正常写入！');
    }
}

testFullFlow().catch(console.error);
