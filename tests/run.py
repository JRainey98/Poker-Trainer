"""Run the JavaScript checks using macOS's system JavaScriptCore framework."""
import ctypes
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
js = ctypes.CDLL('/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore')
ptr = ctypes.c_void_p
js.JSGlobalContextCreate.argtypes = [ptr]
js.JSGlobalContextCreate.restype = ptr
js.JSStringCreateWithUTF8CString.argtypes = [ctypes.c_char_p]
js.JSStringCreateWithUTF8CString.restype = ptr
js.JSEvaluateScript.argtypes = [ptr, ptr, ptr, ptr, ctypes.c_int, ctypes.POINTER(ptr)]
js.JSEvaluateScript.restype = ptr
js.JSValueToStringCopy.argtypes = [ptr, ptr, ctypes.POINTER(ptr)]
js.JSValueToStringCopy.restype = ptr
js.JSStringGetMaximumUTF8CStringSize.argtypes = [ptr]
js.JSStringGetMaximumUTF8CStringSize.restype = ctypes.c_size_t
js.JSStringGetUTF8CString.argtypes = [ptr, ctypes.c_char_p, ctypes.c_size_t]
js.JSStringRelease.argtypes = [ptr]
js.JSGlobalContextRelease.argtypes = [ptr]

context = js.JSGlobalContextCreate(None)
source = '\n'.join([
    'globalThis.__pendingTimers = []; globalThis.setTimeout = callback => __pendingTimers.push(callback);',
    (ROOT / 'poker.js').read_text(),
    (ROOT / 'tests/trainer.test.js').read_text(),
    (ROOT / 'tests/filters.test.js').read_text(),
    'globalThis.__appSource = ' + json.dumps((ROOT / 'app.js').read_text()) + ';',
    'globalThis.__htmlSource = ' + json.dumps((ROOT / 'index.html').read_text()) + ';',
    (ROOT / 'tests/ui.test.js').read_text(),
    '''(async function () {
      try {
        const filters = await runFilterTests();
        const ui = await runUITests();
        globalThis.__testOutput = `${engineTestResult} ${filters} ${ui}`;
      } catch (error) {
        globalThis.__testsFailed = true;
        globalThis.__testOutput = String(error) + '\\n' + error.stack;
      }
      globalThis.__testsDone = true;
    })();''',
])


def evaluate(code):
    script = js.JSStringCreateWithUTF8CString(code.encode())
    error = ptr()
    value = js.JSEvaluateScript(context, script, None, None, 1, ctypes.byref(error))
    output = js.JSValueToStringCopy(context, error if error.value else value, None)
    buffer = ctypes.create_string_buffer(js.JSStringGetMaximumUTF8CStringSize(output))
    js.JSStringGetUTF8CString(output, buffer, len(buffer))
    result = buffer.value.decode()
    js.JSStringRelease(output)
    js.JSStringRelease(script)
    if error.value:
        raise RuntimeError(result)
    return result


try:
    evaluate(source)
    deadline = time.monotonic() + 15
    while True:
        status = json.loads(evaluate('JSON.stringify({done: !!globalThis.__testsDone, failed: !!globalThis.__testsFailed, output: globalThis.__testOutput})'))
        if status['done']:
            print(status['output'])
            raise SystemExit(1 if status['failed'] else 0)
        if time.monotonic() > deadline:
            raise RuntimeError('Tests timed out')
        evaluate('for (const callback of __pendingTimers.splice(0)) callback();')
finally:
    js.JSGlobalContextRelease(context)
