// 从 parquet 文件提取股票代码
const parquet = require('parquetjs');
const fs = require('fs');
const path = require('path');

async function extractStockCodes() {
    const parquetPath = path.join(__dirname, 'data', 'stock_data_daily', 'combined_data.parquet');
    const outputPath = path.join(__dirname, 'data', 'stock_data_daily', 'stock_list.txt');
    
    console.log('📖 读取 parquet 文件...\n');
    
    try {
        const reader = await parquet.ParquetReader.openFile(parquetPath);
        const schema = reader.getSchema();
        
        console.log('✅ parquet 文件信息:');
        console.log(`  列数：${schema.fields.length}`);
        console.log(`  列名：${schema.fields.map(f => f.name).join(', ')}\n`);
        
        // 查找股票代码列
        let codeField = schema.fields.find(f => 
            f.name.toLowerCase().includes('ts_code') || 
            f.name.toLowerCase().includes('code') ||
            f.name.toLowerCase().includes('stock')
        );
        
        if (!codeField) {
            console.log('⚠️ 未找到明确的股票代码列，使用第一个字段');
            codeField = schema.fields[0];
        }
        
        console.log(`📋 使用列：${codeField.name}\n`);
        
        // 读取所有数据提取股票代码
        const cursor = reader.getCursor();
        const stockCodes = new Set();
        let rowCount = 0;
        let row;
        
        console.log('📊 提取股票代码...');
        
        while (row = await cursor.next()) {
            const code = row[codeField.name];
            if (code && typeof code === 'string') {
                stockCodes.add(code);
            }
            rowCount++;
            
            // 每 10 万行显示进度
            if (rowCount % 100000 === 0) {
                process.stdout.write(`\r  已处理 ${rowCount} 行，unique 代码：${stockCodes.size}`);
            }
        }
        
        console.log(`\r✅ 处理完成！总行数：${rowCount}, unique 股票代码：${stockCodes.size}\n`);
        
        // 保存到文件
        const codes = Array.from(stockCodes).sort();
        fs.writeFileSync(outputPath, codes.join('\n'), 'utf8');
        
        console.log(`✅ 股票列表已保存到：${outputPath}`);
        console.log(`📁 共 ${codes.length} 只股票\n`);
        
        console.log('📋 前 20 只股票:');
        codes.slice(0, 20).forEach(code => {
            console.log(`  ${code}`);
        });
        
        await reader.close();
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    }
}

extractStockCodes();
