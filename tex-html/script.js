let currentTab = 0;
const numTabs = 10;
let texts = new Array(numTabs).fill("");

// ローカルストレージからテキストを読み込み
function loadTexts() {
    const savedTexts = JSON.parse(localStorage.getItem('texts'));
    if (savedTexts) {
        texts = savedTexts;
        document.getElementById("editor").value = texts[currentTab];
        updatePreview();
    }
}

// ローカルストレージにテキストを保存
function saveTexts() {
    localStorage.setItem('texts', JSON.stringify(texts));
}

function switchTab(tabIndex) {
    texts[currentTab] = document.getElementById("editor").value;
    saveTexts();
    currentTab = tabIndex;

    document.querySelectorAll('.tab').forEach((tab, index) => {
        tab.classList.toggle('active', index === currentTab);
    });

    document.getElementById("editor").value = texts[currentTab];
    updatePreview();
}

function updatePreview() {
    const previewElement = document.getElementById("preview");
    let editorText = document.getElementById("editor").value;

    // 不等号をエンティティに変換
    editorText = editorText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // LaTeX環境をHTMLタグに変換
    editorText = editorText
        .replace(/\\begin{quote}/g, '<blockquote>')
        .replace(/\\end{quote}/g, '</blockquote>')
        .replace(/\\begin{itemize}/g, '<ul>')
        .replace(/\\end{itemize}/g, '</ul>')
        .replace(/\\item/g, '<li>')
        .replace(/\\textbf{([^}]+)}/g, '<strong>$1</strong>');  // 太字

    // 数式デリミタの前後にスペースを追加
    editorText = editorText
        .replace(/([^ ])(\$)/g, '$1 $2')
        .replace(/(\$)([^ ])/g, '$1 $2')
        .replace(/([^ ])(\\\()/g, '$1 \\( ')
        .replace(/(\\\))([^ ])/g, ' \\) $2');

    // 改行を <br> タグに変換
    const formattedText = editorText.replace(/\n/g, '<br>');

    // KaTeXでレンダリング（$$、$、\[\]、\(\)も対応）
    previewElement.innerHTML = formattedText;
    renderMathInElement(previewElement, {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\[", right: "\\]", display: true},
            {left: "\\(", right: "\\)", display: false}
        ]
    });
}

// ページ読み込み時にテキストをロード
window.onload = loadTexts;
