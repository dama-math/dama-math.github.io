document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const btnText = calculateBtn.querySelector('.btn-text');
    const btnLoader = document.getElementById('btn-loader');
    const resultContainer = document.getElementById('result-container');
    const polynomialResult = document.getElementById('polynomial-result');
    const inputX = document.getElementById('perm-x');
    const inputW = document.getElementById('perm-w');
    
    // Theme logic
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    const htmlElement = document.documentElement;
    
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        htmlElement.setAttribute('data-theme', 'dark');
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
    }
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            htmlElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        } else {
            htmlElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        }
    });

    // Modal logic
    const modal = document.getElementById('docs-modal');
    const openDocsBtn = document.getElementById('open-docs');
    const closeDocsBtn = document.getElementById('close-docs');
    
    openDocsBtn.addEventListener('click', () => {
        modal.showModal();
    });
    
    closeDocsBtn.addEventListener('click', () => {
        modal.close();
    });
    
    modal.addEventListener('click', (e) => {
        const dialogDimensions = modal.getBoundingClientRect();
        if (
            e.clientX < dialogDimensions.left ||
            e.clientX > dialogDimensions.right ||
            e.clientY < dialogDimensions.top ||
            e.clientY > dialogDimensions.bottom
        ) {
            modal.close();
        }
    });

    // Worker logic
    let worker = null;
    let isCalculating = false;

    function initWorker() {
        if (worker) {
            worker.terminate();
        }
        
        worker = new Worker('worker.js');
        
        worker.onmessage = function(e) {
            const data = e.data;
            if (data.type === 'ready') {
                btnText.textContent = 'Calculate';
                btnLoader.classList.add('hidden');
                calculateBtn.disabled = false;
            } else if (data.type === 'result') {
                isCalculating = false;
                resetUI();
                
                if (data.result.startsWith('Error:')) {
                    showResult(data.result, true);
                } else {
                    showResult(data.result, false);
                }
            } else if (data.type === 'error') {
                isCalculating = false;
                resetUI();
                showResult(data.error, true);
            }
        };

        worker.onerror = function(err) {
            isCalculating = false;
            resetUI();
            showResult('Worker Error: ' + err.message, true);
        };
    }

    // Initial worker setup
    initWorker();

    function resetUI() {
        btnText.textContent = 'Calculate';
        btnLoader.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        calculateBtn.disabled = false;
    }

    calculateBtn.addEventListener('click', () => {
        const strX = inputX.value.trim();
        const strW = inputW.value.trim();

        if (!strW) {
            showResult('Please enter Permutation w.', true);
            return;
        }

        isCalculating = true;
        calculateBtn.disabled = true;
        btnText.textContent = 'Calculating...';
        btnLoader.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        worker.postMessage({
            type: 'calculate',
            strX: strX,
            strW: strW
        });
    });

    cancelBtn.addEventListener('click', () => {
        if (isCalculating) {
            worker.terminate();
            initWorker();
            isCalculating = false;
            resetUI();
            
            calculateBtn.disabled = true;
            btnText.textContent = 'Initializing Engine...';
            
            showResult('Calculation cancelled.', true);
        }
    });

    function showResult(text, isError) {
        resultContainer.classList.remove('hidden');
        polynomialResult.textContent = text;
        
        if (isError) {
            polynomialResult.classList.add('error-text');
        } else {
            polynomialResult.classList.remove('error-text');
        }
    }
});
