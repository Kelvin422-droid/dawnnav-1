/**
 * 导航网站中间跳转页功能
 * 
 * 此脚本会监听所有导航链接的点击事件，将链接重定向到中间跳转页
 * 并尝试获取目标网站的描述信息
 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取所有导航卡片链接
    const navLinks = document.querySelectorAll('.xe-widget.xe-conversations');
    
    // 获取网站基础URL - 修复：始终使用根路径而不是当前页面路径
    const baseURL = window.location.origin;
    
    // 创建一个生成随机ID的函数
    function generateRandomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // 创建一个检查链接是否需要跳转的函数
    function shouldRedirect(url) {
        // 排除内部链接和锚点链接
        if (!url || url.startsWith('#') || url.startsWith('javascript:')) {
            return false;
        }
        
        // 如果是当前站点的链接，不跳转
        const currentOrigin = window.location.origin;
        try {
            const urlOrigin = new URL(url).origin;
            if (urlOrigin === currentOrigin) {
                return false;
            }
        } catch (e) {
            // 如果URL解析失败，假设需要跳转
            return true;
        }
        
        return true;
    }
    
    // 获取网站描述信息
    function getWebsiteDescription(element) {
        // 首先尝试获取卡片上的描述
        const descElement = element.querySelector('.xe-comment p');
        if (descElement && descElement.textContent.trim()) {
            return descElement.textContent.trim();
        }
        
        // 如果卡片上没有描述，尝试从title属性获取
        const linkElement = element.closest('a');
        if (linkElement && linkElement.title && linkElement.title.trim()) {
            return linkElement.title.trim();
        }
        
        return null;
    }
    
    // 对每个链接添加点击事件处理
    navLinks.forEach(function(link) {
        link.addEventListener('click', function(event) {
            const targetURL = this.getAttribute('href');
            
            // 如果链接需要通过中间页跳转
            if (shouldRedirect(targetURL)) {
                event.preventDefault();
                
                // 获取网站标题
                const title = this.querySelector('.xe-user-name strong')?.textContent || '外部网站';
                
                // 获取网站描述
                const description = getWebsiteDescription(this);
                
                // 创建随机字符串作为URL的一部分，避免缓存问题
                const randomStr = generateRandomString();
                
                // 将信息存储到localStorage中，以便跳转页面使用
                const gotoData = {
                    title: title,
                    targetURL: targetURL,
                    description: description
                };
                localStorage.setItem('goto_' + randomStr, JSON.stringify(gotoData));
                
                // 跳转到中间页 - 在新标签页打开
                window.open(baseURL + '/goto/?id=' + randomStr, '_blank');
            }
        });
    });
});