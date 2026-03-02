// 直接读取 parquet 文件二进制内容
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readParquetInfo(filePath) {
    console.log('========================================');
    console.log('  Parquet 文件分析工具');
    console.log('========================================\n');
    
    const stats = fs.statSync(filePath);
    console.log(`📁 文件：${filePath}`);
    console.log(`📊 大小：${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
    
    // 读取文件头部（parquet magic number）
    const buffer = fs.readFileSync(filePath, { encoding: null });
    
    // Parquet 文件以 "PAR1" 开头
    const magic = buffer.slice(0, 4).toString('ascii');
    console.log(`🔍 Magic Number: ${magic}`);
    
    if (magic !== 'PAR1') {
        console.log('⚠️ 不是标准 parquet 文件!');
        
        // 尝试检测文件类型
        if (buffer.slice(0, 6).toString('ascii') === 'PANDA') {
            console.log('ℹ️  这是 pandas 生成的 parquet 文件');
        }
        
        // 尝试读取前 1000 字节找股票代码模式
        console.log('\n🔍 尝试从原始数据中提取股票代码...\n');
        
        const text = buffer.toString('utf8', 0, Math.min(100000, buffer.length));
        const codePattern = /\b([0-9]{6})\.(SH|SZ|BJ)\b/g;
        const codes = new Set();
        
        let match;
        while ((match = codePattern.exec(text)) !== null) {
            codes.add(match[0]);
            if (codes.size >= 50) break;
        }
        
        if (codes.size > 0) {
            console.log(`✅ 找到 ${codes.size} 个股票代码模式:\n`);
            Array.from(codes).slice(0, 30).forEach(code => {
                console.log(`  ${code}`);
            });
        } else {
            console.log('⚠️ 未找到股票代码模式');
        }
        
        return;
    }
    
    console.log('✅ 标准 parquet 格式\n');
    
    // parquet 文件尾部也有 "PAR1"
    const tailMagic = buffer.slice(-4).toString('ascii');
    console.log(`🔍 尾部 Magic: ${tailMagic}`);
    
    // 读取 footer
    const footerSize = buffer.readUInt32LE(buffer.length - 8);
    console.log(`📊 Footer 大小：${footerSize} bytes\n`);
    
    console.log('ℹ️  需要使用 parquet 解析库来读取完整数据');
    console.log('💡 建议安装：pip install pandas pyarrow');
}

const parquetPath = path.join(__dirname, 'data', 'stock_data_daily', 'combined_data.parquet');
readParquetInfo(parquetPath);
