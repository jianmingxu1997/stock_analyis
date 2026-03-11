/**
 * ========================================
 * 删除 GitHub 文件夹脚本
 * ========================================
 */

const axios = require('axios');

const GITHUB_CONFIG = {
    owner: 'jianmingxu1997',
    repo: 'stock_analyis',
    token: process.env.GITHUB_TOKEN || '',
    branch: 'main'
};

async function deleteGitHubFile(filePath, message) {
    try {
        // 先获取文件 SHA
        const checkResponse = await axios.get(
            `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 30000
            }
        );
        
        const sha = checkResponse.data.sha;
        console.log(`🗑️  删除：${filePath}`);
        
        // 删除文件
        await axios.delete(
            `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                data: {
                    message: message,
                    sha: sha,
                    branch: GITHUB_CONFIG.branch
                },
                timeout: 30000
            }
        );
        
        console.log(`   ✅ 删除成功`);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`   ⚠️  文件不存在，跳过`);
            return false;
        }
        console.error(`   ❌ 删除失败：${error.message}`);
        throw error;
    }
}

async function main() {
    console.log('========================================');
    console.log('  删除 GitHub 文件夹');
    console.log('========================================\n');
    
    // 删除 20260310 文件夹中的文件
    await deleteGitHubFile(
        'daily/20260310/20260309_小斐选股_行业 top20.xlsx',
        '删除误上传的文件（日期错误）'
    );
    
    await deleteGitHubFile(
        'daily/20260310/小斐智能选股 1.0.html',
        '删除误上传的文件（日期错误）'
    );
    
    console.log('\n========================================');
    console.log('  删除完成！');
    console.log('========================================');
}

main().catch(console.error);
