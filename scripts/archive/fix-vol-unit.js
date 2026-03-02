/**
 * 修正 3 月 2 日数据的 vol 单位（股转手）
 */

const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const CSV_FILES = ['sh_main.csv', 'sz_main.csv', 'chinext.csv', 'star.csv', 'bse.csv'];

console.log('========================================');
console.log('  修正 3 月 2 日数据 vol 单位（股转手）');
console.log('========================================\n');

CSV_FILES.forEach(csvFile => {
    const filePath = path.join(MERGED_DIR, csvFile);
    
    if (!fs.existsSync(filePath)) {
        console.log(`跳过：${csvFile} (文件不存在)`);
        return;
    }
    
    console.log(`处理：${csvFile}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    let modified = 0;
    let skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        
        if (fields.length < 10) continue;
        
        // 检查是否是 3 月 2 日的数据
        if (fields[1] !== '20260302') {
            skipped++;
            continue;
        }
        
        // 修正 vol（除以 100，股转手）
        const oldVol = fields[9];
        const newVol = Math.round(parseFloat(oldVol) / 100);
        
        if (!isNaN(newVol)) {
            fields[9] = newVol.toString();
            lines[i] = fields.join(',');
            modified++;
        }
    }
    
    // 写回文件
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    
    console.log(`  修正：${modified} 条`);
    console.log(`  跳过：${skipped} 条 (非 3 月 2 日数据)`);
    console.log('');
});

console.log('========================================');
console.log('  修正完成！');
console.log('========================================\n');
