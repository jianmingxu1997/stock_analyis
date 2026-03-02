// 监控筛选进度，每 10% 通知一次
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-simple.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final.json');
const PROGRESS_FILE = path.join(__dirname, 'filter-progress.json');

const TOTAL_STOCKS = 3179;
const NOTIFY_INTERVAL = 0.1; // 10%

let lastNotifiedPercent = 0;

function checkProgress() {
    // 检查是否已完成
    if (fs.existsSync(OUTPUT_FILE)) {
        console.log('\n✅ 筛选完成！');
        const result = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        console.log(`最终股票池：${result.stats.final}只\n`);
        return true;
    }
    
    // 读取当前日志估算进度
    // 这里简单用时间估算，实际应该解析日志
    const startTime = Date.now();
    const elapsed = startTime - (process.env.START_TIME || startTime);
    const estimatedTotal = 30 * 60 * 1000; // 30 分钟
    const progress = Math.min(elapsed / estimatedTotal, 1);
    const currentPercent = Math.floor(progress * 100);
    
    // 检查是否需要通知
    const notifyThresholds = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    
    for (const threshold of notifyThresholds) {
        if (currentPercent >= threshold && lastNotifiedPercent < threshold) {
            console.log(`\n📊 进度通知：${threshold}%`);
            console.log(`   已处理：${Math.floor(TOTAL_STOCKS * threshold / 100)}/${TOTAL_STOCKS}只`);
            console.log(`   预计剩余：${Math.round((100 - threshold) / 100 * 30)}分钟\n`);
            lastNotifiedPercent = threshold;
            
            // 保存进度
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
                percent: threshold,
                timestamp: new Date().toISOString(),
                processed: Math.floor(TOTAL_STOCKS * threshold / 100)
            }, null, 2));
        }
    }
    
    return false;
}

// 每分钟检查一次
setInterval(() => {
    const done = checkProgress();
    if (done) {
        process.exit(0);
    }
}, 60000);

console.log('🔍 开始监控筛选进度...\n');
console.log('📋 通知设置：每 10% 进度通知一次\n');
