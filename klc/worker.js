// Safari/WebKit compatibility fix for resizable ArrayBuffer issues.
// New Emscripten versions use wasmMemory.toResizableBuffer() to convert Wasm memory into a
// resizable ArrayBuffer. Safari's incomplete support causes "TypeError: Type error" when
// TypedArray views backed by resizable buffers are passed to TextDecoder.decode() or other APIs.
// By making toResizableBuffer() fail, Emscripten falls back to standard (non-resizable) ArrayBuffer.
if (typeof WebAssembly !== 'undefined' && WebAssembly.Memory && WebAssembly.Memory.prototype.toResizableBuffer) {
    // Only patch on Safari / WebKit, where resizable ArrayBuffer support is problematic
    var isSafari = /^((?!chrome|android).)*safari|AppleWebKit/i.test(self.navigator?.userAgent || '');
    if (isSafari) {
        WebAssembly.Memory.prototype.toResizableBuffer = function() {
            throw new TypeError('Disabled for Safari compatibility');
        };
    }
}

// Secondary safety net: patch TextDecoder for any remaining resizable buffer edge cases
var _origDecode = TextDecoder.prototype.decode;
TextDecoder.prototype.decode = function(input, options) {
    try {
        return _origDecode.call(this, input, options);
    } catch (e) {
        if (e instanceof TypeError && input && typeof input.slice === 'function') {
            // Copy into a non-resizable buffer and retry
            return _origDecode.call(this, input.slice(), options);
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
