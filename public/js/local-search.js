/* 本地搜索功能
*/
var input = document.getElementById("search-input");
var resultsList = document.getElementById('search-results');
var items = resultsList.getElementsByTagName("li");
// 定义一个防抖函数，避免频繁触发输入事件
function debounce(fn, delay) {
    var timer = null; // 定义一个定时器
    return function() {
        var context = this; // 保存this指向
        var args = arguments; // 保存参数
        clearTimeout(timer); // 清除上一次的定时器
        timer = setTimeout(function() { // 设置新的定时器
            fn.apply(context, args);
        }, delay); // 延迟时间
    }
}
//根据pinyin-pro匹配的下标，获取匹配到的字
function getMatchedWord(text, index) {
    // 如果下标是一个数字，就返回对应位置的字符
    if (index == Number(index)) {
        return text[index];
    }   
    // 如果下标是一个数组，就返回对应范围的字符串
    if (Array.isArray(index)) {
        var result = "";
        for (var i = 0; i < index.length; i++) {
            result += text.charAt(index[i]);
        }
        return result;
    }  
    return '';
}

// 生成随机ID，用于中间跳转页
function generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 封装搜索逻辑
function search() {
    var keyword = this.value;  
    if (keyword.trim() === '') { // 检查keyword是否为空或只包含空格   
        resultsList.innerHTML = '<span>搜索本页内容</span>';  // 清空结果列表  
        return;  
    }
    if (encodeURIComponent(keyword.trim()).length === 1) { // 检查keyword长度  
        resultsList.innerHTML = '<span><strong>提示：</strong>至少输入2个字母、数字或1个汉字</span>';
        return;  
    }    
    var xCards = document.getElementsByClassName('xe-card');  
    var results = []; // 存储匹配结果的数组
    let regex = new RegExp(keyword, 'i'); // 'i' 标志表示不区分大小写     
    if (typeof pinyinPro !== 'undefined') { //https://pinyin-pro.cn/use/match.html
        var { match:pyMatch } = pinyinPro;
    } 
    for (var i = 0; i < xCards.length; i++) {  
        var cardLink = xCards[i].querySelector('a');  
        // 获取a标签中class为overflowClip_1、2的文本内容
        var clipContent = cardLink.querySelector('.overflowClip_1').textContent.trim() + " - " + cardLink.querySelector('.overflowClip_2').textContent.trim();
        var imgSrc = cardLink.querySelector('img').getAttribute('data-src'); 
        if (cardLink) {
            // 常规匹配
            let wordMatch = clipContent.match(regex);
            // 拼音匹配
            if (pyMatch !== undefined && /^[a-zA-Z0-9]/.test(keyword)) { 
               var pinyinMatch = pyMatch(clipContent, keyword, { continuous: true, precision: 'start'});
            }
            if (wordMatch || pinyinMatch ) {
                // 将匹配的需要用到的内容 添加到结果数组中   
                results.push({
                    href: cardLink.href,
                    text: clipContent,
                    dataSrc: imgSrc,
                    pyMatch: pinyinMatch,
                    wdMatch: wordMatch
                });  
            }  
        }  
    }  
    
    resultsList.innerHTML = '';  // 清空结果列表
    if (results.length > 0) {
        var defaultLogo = rootPath+'images/favicon.png';
        for (let j = 0; j < results.length; j++) { // block-scoped j
            const data = results[j]; // capture result for each iteration
            // 生成高亮文本
            const word = data.wdMatch ? data.wdMatch[0] : getMatchedWord(data.text, data.pyMatch);
            const highlight = "<strong>" + word + "</strong>";
            const newtext = data.text.replace(word, highlight);
            // 创建列表项
            var listItem = document.createElement('li');
            // 创建图标
            var newIcon = document.createElement('i');
            var img = document.createElement('img');
            img.classList.add('lazy');
            img.src = defaultLogo;
            img.setAttribute('data-src', data.dataSrc);
            img.setAttribute('onerror', `javascript:this.src='${defaultLogo}'`);
            newIcon.appendChild(img);
            // 创建链接，拦截点击事件跳转至中间页
            var newLink = document.createElement('a');
            newLink.href = 'javascript:void(0);';
            newLink.innerHTML = newtext;
            newLink.addEventListener('click', function() {
                var randomStr = generateRandomString();
                // 从搜索结果文本中提取描述信息，格式是"标题 - 描述"
                const parts = data.text.split(' - ');
                const title = parts[0];
                const description = parts.length > 1 ? parts.slice(1).join(' - ') : '';
                
                localStorage.setItem('goto_' + randomStr, JSON.stringify({
                    title: title,
                    targetURL: data.href,
                    description: description  // 使用提取的描述信息
                }));
                window.open(window.location.origin + '/goto/?id=' + randomStr, '_blank');
            });
            listItem.appendChild(newIcon);
            listItem.appendChild(newLink);
            resultsList.appendChild(listItem);
        }
        $("img.lazy").lazyload();
    } else {  
        resultsList.innerHTML = '<span>没有找到匹配的内容。</span>';        
    }
}
// 添加输入事件监听，使用防抖函数包裹搜索函数，设置延迟时间为300ms
input.addEventListener("input", debounce(search, 300));

/*搜索按钮：打开搜索框*/
document.getElementById('search-btn').addEventListener('click', function() {  
    var searchBox = document.getElementById('overlay');  
    if (searchBox.style.display === 'none') {  
    searchBox.style.display = 'block';
    var inputElement = document.getElementById('search-input');  
    inputElement.focus(); 
    } else {  
    searchBox.style.display = 'none';
    }  
});
/*Ctrl+F：打开搜索框*/
document.addEventListener('keydown', function(event) { 
    var searchBox = document.getElementById('overlay');
    var inputElement = document.getElementById('search-input');  
    if (event.ctrlKey && event.key === 'f') { // CTRL+F  
        if (searchBox.style.display === 'none') {               
            searchBox.style.display = 'block';
            inputElement.focus();
            event.preventDefault(); // 阻止默认行为 
        }else{
            searchBox.style.display = 'none';
            event.preventDefault();
        }
    }  
});
/*点击空白处：关闭搜索框*/
document.getElementById('overlay').addEventListener('click', function(event) {  
    var searchBox = document.getElementById('search-box');   
    if (!searchBox.contains(event.target)) {
    // 点击的不是search-box本身或其子元素  
    this.style.display = 'none';
    }  
});
/*搜索框关闭按钮*/
document.getElementById('close-button').addEventListener('click', function(event) {
     var searchBox = document.getElementById('overlay'); 
     searchBox.style.display = 'none';
});
/*键盘事件：结果列表选择*/        

var index = -1; // 当前选中的索引
document.addEventListener("keydown", function (event) {
    // 如果按下上箭头
    if (event.key === 'ArrowUp') {
        // 如果当前没有选中任何项，或者已经选中第一项，就选中最后一项
        if (index == -1 || index == 0) {
            index = items.length - 1;
        } else {
            index--;// 否则，选中上一项
        }
        // 遍历所有的项，给选中的项添加高亮样式，其他项移除高亮样式
        for (var i = 0; i < items.length; i++) {
            if (i == index) {
                items[i].classList.add("highlight");
                // 滚动到选中的项的位置
                items[i].scrollIntoView();
            } else {
                items[i].classList.remove("highlight");
            }
        }
    }
    // 如果按下下箭头
    if (event.key === 'ArrowDown') {
        var height = items[0].offsetHeight; // 每个li的高度
        var visible = Math.floor(resultsList.clientHeight / height); // 可视区域内能显示的li的个数
        if (index == -1 || index == items.length - 1) {
            index = 0;
        } else {
            index++;// 否则，选中下一项
        }
        // 遍历所有的项，给选中的项添加高亮样式，其他项移除高亮样式
        for (var i = 0; i < items.length; i++) {
            if (i == index) {
                items[i].classList.add("highlight");
                // 如果选中的项在可视区域的第一个或者最后一个，就滚动到选中的项的位置
                if (i % visible == 0 || i % visible == visible - 1) {
                    // 滚动到选中的项的位置
                    items[i].scrollIntoView();
                }
            } else {
                items[i].classList.remove("highlight");
            }
        }
    }
    // 如果按下回车键
    if (event.key === 'Enter') {
        // 如果当前有选中的项，就触发该项的链接的点击事件
        if (index != -1) {
            var link = items[index].getElementsByTagName("a")[0];
            link.click();
        }
    }
});
