// Adapts TDLib's tdweb package (written for Emscripten 3.1.1) to a TDLib built with Emscripten 6.
// Usage: node fix-tdweb-for-emscripten6.js <tdweb package dir> <dir with @babel/core@7 and @babel/preset-env@7>
//
// Run after copy-tdlib.sh and before build-tdweb.sh. td_wasm must be linked with
// -s EXPORTED_RUNTIME_METHODS="['FS','cwrap','IDBFS','WORKERFS']" -s ENVIRONMENT=web,worker
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const pkgDir = path.resolve(process.argv[2]);
const babelRequire = createRequire(path.join(path.resolve(process.argv[3]), 'package.json'));
const babel = babelRequire('@babel/core');

// 1. webpack 4 (acorn 6) cannot parse ?., ?? and class fields, or resolve require("node:...").
const wasmJs = path.join(pkgDir, 'src/prebuilt/release/td_wasm.js');
let code = fs.readFileSync(wasmJs, 'utf8');
code = code.replace(/require\("node:([a-z_/]+)"\)/g, 'require("$1")');
// TDLib's post.js sets createTdwebModule.ready.FS, but `ready` is gone in Emscripten 6 and the
// assignment throws during startup. worker.js gets FS from the module object instead (see 2.).
code = code.replace(/createTdwebModule\.ready\.FS\s*=\s*Module\.FS;?/, '');
code = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    compact: true,
    presets: [[babelRequire.resolve('@babel/preset-env'), { targets: { chrome: '70' }, modules: false }]]
}).code;
fs.writeFileSync(wasmJs, code);
console.log(`downleveled ${wasmJs}`);

// 2. The factory now returns a Promise, so read FS from the object passed in, and
//    FS.filesystems no longer exists, so rebuild it from the exported IDBFS/WORKERFS.
const workerJs = path.join(pkgDir, 'src/worker.js');
let worker = fs.readFileSync(workerJs, 'utf8');
const before = `  let module = createTdwebModule({
    onRuntimeInitialized: () => {
      log.info('runtime initialized');
      onFS(module.FS);
    },`;
const after = `  const moduleArg = {
    onRuntimeInitialized: () => {
      log.info('runtime initialized');
      const FS = moduleArg.FS;
      FS.filesystems = FS.filesystems || {
        IDBFS: moduleArg.IDBFS,
        WORKERFS: moduleArg.WORKERFS
      };
      onFS(FS);
    },`;
if (worker.includes(after)) {
    console.log(`${workerJs} already patched`);
} else {
    if (!worker.includes(before)) throw new Error(`unexpected ${workerJs}; patch it by hand`);
    worker = worker.replace(before, after);

    const closeBefore = `      instantiateAny(tdlibVersion, td_wasm, imports).then(next);
      return {};
    }
  });`;
    const closeAfter = `      instantiateAny(tdlibVersion, td_wasm, imports).then(next);
      return {};
    }
  };
  let module = createTdwebModule(moduleArg);`;
    if (!worker.includes(closeBefore)) throw new Error(`unexpected ${workerJs}; patch it by hand`);
    worker = worker.replace(closeBefore, closeAfter);
    fs.writeFileSync(workerJs, worker);
    console.log(`patched ${workerJs}`);
}
