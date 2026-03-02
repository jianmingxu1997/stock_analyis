/**
 * 最终测试 - 模拟完整的 appendToCSV 流程
 */

const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const CSV_FILE = path.join(MERGED_DIR, 'sh_main.csv');

// 模拟 API 返回的数据
const data = [{
    ts_code: '600000.SH',
    trade_date: '20260302',
    open: 9.69,
    high: 9.77,
    low: 9.58,
    close: 9.68,
    pre_close: 9.72,
    change: -0.04,
    pct_chg: -0.41,
    vol: 73404604,
    amount: 71079.58
}];

console.log('========================================');
console.log('  最终测试 - 模拟 appendToCSV');
console.log('========================================\n');

console.log('测试数据:');
console.log(JSON.stringify(data, null, 2));
console.log('');

// 读取 CSV
const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.trim().split('\n');

console.log('CSV 信息:');
console.log('  总行数:', lines.length);
console.log('');

// 检查现有日期
const existingDates = new Set();
for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',');
    if (fields.length > 1) {
        existingDates.add(fields[1]);
    }
}

console.log('日期检查:');
console.log('  API 日期:', data[0].trade_date);
console.log('  CSV 最新:', Array.from(existingDates)[0]);
console.log('  CSV 是否有此日期:', existingDates.has(data[0].trade_date));
console.log('');

// 模拟过滤逻辑（修复后的）
const newData = data.filter(d => !existingDates.has(d.trade_date));

console.log('过滤结果:');
console.log('  newData 长度:', newData.length);
console.log('  是否应该写入:', newData.length > 0 ? '✅ 是' : '❌ 否');
console.log('');

if (newData.length > 0) {
    console.log('✅ 数据会正常写入！');
    console.log('');
    console.log('将要写入的数据:');
    newData.forEach(d => {
        console.log(`  ${d.ts_code},${d.trade_date},${d.open},${d.high},${d.low},${d.close},...`);
    });
} else {
    console.log('❌ 数据被过滤掉了！');
    console.log('   原因：CSV 里已经有这个日期了');
}
