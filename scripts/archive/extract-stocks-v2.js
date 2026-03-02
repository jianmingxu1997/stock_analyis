// 从 parquet 文件提取股票代码 - 增强版
const parquet = require('parquetjs');
const fs = require('fs');
const path = require('path');

async function extractStockCodes() {
    const parquetPath = path.join(__dirname, 'data', 'stock_data_daily', 'combined_data.parquet');
    const outputPath = path.join(__dirname, 'data', 'stock_data_daily', 'stock_list.txt');
    
    console.log('========================================');
    console.log('  Parquet 文件读取工具');
    console.log('========================================\n');
    
    // 检查文件是否存在
    if (!fs.existsSync(parquetPath)) {
        console.log(`❌ 文件不存在：${parquetPath}`);
        console.log('\n当前目录结构:');
        console.log(`  ${__dirname}`);
        try {
            const files = fs.readdirSync(path.join(__dirname, 'data'));
            files.forEach(f => console.log(`    - ${f}`));
        } catch (e) {}
        return;
    }
    
    const stats = fs.statSync(parquetPath);
    console.log(`📁 文件路径：${parquetPath}`);
    console.log(`📊 文件大小：${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 最后修改：${stats.mtime}\n`);
    
    try {
        console.log('📖 打开 parquet 文件...\n');
        
        const reader = await parquet.ParquetReader.openFile(parquetPath);
        const schema = reader.getSchema();
        
        console.log('✅ 成功打开文件!\n');
        console.log('📋 Schema 信息:');
        console.log(`  列数：${schema.fields.length}`);
        console.log(`  行数列：${schema.fields.map(f => f.name).join(', ')}\n`);
        
        // 查找股票代码列
        let codeField = schema.fields.find(f => 
            f.name.toLowerCase().includes('ts_code') || 
            f.name.toLowerCase().includes('code') ||
            f.name.toLowerCase().includes('stock') ||
            f.name.toLowerCase().includes('symbol')
        );
        
        if (!codeField) {
            console.log('⚠️ 未找到明确的股票代码列，尝试使用第一个字符串字段');
            codeField = schema.fields.find(f => f.primitiveType === 'BYTE_ARRAY' || f.primitiveType === 'UTF8');
        }
        
        if (!codeField) {
            codeField = schema.fields[0];
        }
        
        console.log(`📍 使用列：${codeField.name} (${codeField.primitiveType})\n`);
        
        // 读取所有数据提取股票代码
        const cursor = reader.getCursor();
        const stockCodes = new Set();
        let rowCount = 0;
        let row;
        
        console.log('📊 开始提取股票代码...\n');
        
        while ((row = await cursor.next()) !== null) {
            const code = row[codeField.name];
            if (code && typeof code === 'string' && code.match(/^[0-9]+\.(SH|SZ|BJ)$/)) {
                stockCodes.add(code);
            }
            rowCount++;
            
            // 每 10 万行显示进度
            if (rowCount % 100000 === 0) {
                process.stdout.write(`\r  已处理 ${rowCount.toLocaleString()} 行，unique 代码：${stockCodes.size}`);
            }
        }
        
        console.log(`\r✅ 提取完成!\n`);
        console.log(`📊 总行数：${rowCount.toLocaleString()}`);
        console.log(`📋 unique 股票代码：${stockCodes.size}\n`);
        
        // 保存到文件
        const codes = Array.from(stockCodes).sort();
        fs.writeFileSync(outputPath, codes.join('\n'), 'utf8');
        
        console.log(`✅ 股票列表已保存到：${outputPath}`);
        console.log(`📁 共 ${codes.length} 只股票\n`);
        
        console.log('📋 前 30 只股票:');
        codes.slice(0, 30).forEach(code => {
            console.log(`  ${code}`);
        });
        
        console.log('\n========================================');
        console.log('  提取完成!');
        console.log('========================================\n');
        
        await reader.close();
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error('\n堆栈跟踪:');
        console.error(error.stack);
        
        console.log('\n💡 建议:');
        console.log('  1. 检查 parquet 文件是否损坏');
        console.log('  2. 尝试用 Python pandas 读取');
        console.log('  3. 检查文件权限');
    }
}

extractStockCodes();
