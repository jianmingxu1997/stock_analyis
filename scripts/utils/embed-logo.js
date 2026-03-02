// 将 Logo 图片 Base64 嵌入到 HTML 中
const fs = require('fs');
const path = require('path');

console.log('🔧 开始嵌入 Logo...\n');

// 读取 Base64
const base64 = fs.readFileSync(path.join(__dirname, 'logo-base64.txt'), 'utf8');
console.log(`📊 Base64 长度：${base64.length} 字符`);

// 读取 HTML
const htmlFile = path.join(__dirname, '小斐智能选股 1.0.html');
let html = fs.readFileSync(htmlFile, 'utf8');

// 替换图片路径为 Base64
const oldSrc = 'src="logo.png"';
const newSrc = `src="data:image/png;base64,${base64}"`;

if (html.includes(oldSrc)) {
    html = html.replace(oldSrc, newSrc);
    console.log('✅ 图片路径已替换为 Base64\n');
} else {
    console.log('❌ 未找到图片引用\n');
    process.exit(1);
}

// 保存 HTML
fs.writeFileSync(htmlFile, html, 'utf8');
console.log(`💾 HTML 已更新：${htmlFile}`);

// 显示新文件大小
const stats = fs.statSync(htmlFile);
console.log(`📁 文件大小：${(stats.size / 1024 / 1024).toFixed(2)} MB`);

console.log('\n✅ 完成！现在 HTML 包含完整的图片数据，可以直接分享啦！🎉');
