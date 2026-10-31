# Vendored tdweb

`tdweb` on npm stops at 1.8.0 (2022). Telegram now rejects logins from that TDLib
version with `UPDATE_APP_TO_LOGIN`, so `tdweb/` here is built from current TDLib sources
(tdlib/td commit `4c6377a`, TDLib 1.8.69) and referenced from `package.json` as
`"tdweb": "file:vendor/tdweb"`.

The app still uses the 1.8.0 API shapes; `src/Controllers/TdApiCompat.js` translates
between the two.

## Rebuilding

On Linux (or WSL) with the TDLib build dependencies (cmake, gperf, g++, php or python):

```bash
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
~/emsdk/emsdk install latest && ~/emsdk/emsdk activate latest
source ~/emsdk/emsdk_env.sh

git clone --depth 1 https://github.com/tdlib/td.git ~/td
cd ~/td/example/web
# The scripts insist on emcc 3.1.1, which has no ARM64 build; newer versions work.
sed -i "s/^emcc --check.*$/true/" build-openssl.sh build-tdlib.sh
./build-openssl.sh
./build-tdlib.sh

# tdweb needs IDBFS and WORKERFS, which Emscripten 6 no longer exposes through FS.filesystems.
# Relink only (no recompile) with them exported and without the Node.js code paths.
(cd build/wasm &&
  sed -i "s/EXPORTED_RUNTIME_METHODS=\"\['FS','cwrap'\]\"/EXPORTED_RUNTIME_METHODS=\"['FS','cwrap','IDBFS','WORKERFS']\" -s ENVIRONMENT=web,worker/" CMakeFiles/td_wasm.dir/link.txt &&
  sh CMakeFiles/td_wasm.dir/link.txt)
./copy-tdlib.sh

# Make td_wasm.js parseable by webpack 4 and patch tdweb's worker.js for the Emscripten 6 module API.
mkdir -p ~/babel-tools && (cd ~/babel-tools && npm init -y && npm install @babel/core@7 @babel/preset-env@7)
node <this repo>/vendor/fix-tdweb-for-emscripten6.js tdweb ~/babel-tools

cd tdweb && npm install --no-save && NODE_OPTIONS=--openssl-legacy-provider npm run build
```

Then copy `tdweb/dist/*` into `vendor/tdweb/dist/`, run `npm install`, copy
`node_modules/tdweb/dist/*` into `public/`, and update `WASM_FILE_NAME` in
`src/Constants.js` to the new `.wasm` file name.
