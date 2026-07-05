// Patch TextDecoder for resizable ArrayBuffer issue in some browsers (e.g., Safari throws generic 'Type error')
const originalDecode = TextDecoder.prototype.decode;
TextDecoder.prototype.decode = function(input, options) {
    try {
        return originalDecode.call(this, input, options);
    } catch (e) {
        if (e instanceof TypeError && input && typeof input.slice === 'function') {
            try {
                return originalDecode.call(this, input.slice(), options);
            } catch (fallbackError) {
                throw e;
            }
        }
        throw e;
    }
};

importScripts('klc.js');

let klcModule = null;

createKlcModule().then(module => {
    klcModule = module;
    postMessage({ type: 'ready' });
}).catch(err => {
    postMessage({ type: 'error', error: err.toString() });
});

onmessage = function(e) {
    if (e.data.type === 'calculate') {
        const { strX, strW } = e.data;
        if (!klcModule) {
            postMessage({ type: 'error', error: 'Module not loaded yet' });
            return;
        }

        try {
            const result = klcModule.calculateKlPolynomial(strX, strW);
            postMessage({ type: 'result', result: result });
        } catch (error) {
            postMessage({ type: 'error', error: error.toString() });
        }
    }
};
