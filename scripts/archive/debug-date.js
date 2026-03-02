/**
 * 调试日期检查逻辑
 */

const fs = require('fs');
const path = require('path');

const csvFile = path.join(__dirname, 'data', 'merged', 'sh_main.csv');
const content = fs.readFileSync(csvFile, 'utf8');
const lines = content.trim().split('\n');

console.log('========================================');
console.log('  调试日期检查逻辑');
console.log('========================================\n');

console.log('CSV 文件总行数:', lines.length);
console.log('');

// 检查现有日期
const existingDates = new Set();
for (let i = 1; i < lines.length; i++) {
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

console.log('CSV 里最新日期:', Array.from(existingDates)[0]);
console.log('');

// 测试 API 返回的日期
const apiDate = '20260302';
console.log('API 返回的日期:', apiDate);
console.log('');

// 检查是否会写入
const shouldWrite = !existingDates.has(apiDate);
console.log('是否应该写入:', shouldWrite ? '✅ 是' : '❌ 否');
console.log('');

if (!shouldWrite) {
    console.log('原因：CSV 里已经有这个日期了！');
}
