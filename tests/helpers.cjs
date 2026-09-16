const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
function load(relativePath, overrides = {}, modules = {}) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const nativeRequire = createRequire(filename)
  const requireModule = name => {
    if (name in modules) return modules[name]
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, overrides, modules)
    return nativeRequire(name)
  }
  vm.runInNewContext(outputText, {
    module, exports: module.exports, require: requireModule, Buffer, Request, Response, Headers, AbortSignal,
    process: { env: {} }, console,
    fetch: async () => { throw new Error('External network calls are forbidden in tests') },
    ...overrides,
  }, { filename })
  return module.exports
}
module.exports = { load }
