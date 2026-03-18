const { join } = require("path")
const vuePlugin = require("@vitejs/plugin-vue")
const { defineConfig } = require("vite")

function resolve(dir) {
    return join(__dirname, '..', dir)
}

const root = resolve('src/renderer')

const config = defineConfig({
    mode: 'production',
    root,
    resolve: {
        alias: {
            '@renderer': root,
        }
    },
    base: './',
    build: {
        outDir: resolve('dist/android'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve('src/renderer/android.html')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                manualChunks: {
                    vendor: ['vue', 'element-plus'],
                }
            }
        }
    },
    plugins: [
        vuePlugin({
            script: {
                refSugar: true
            }
        })
    ],
    publicDir: resolve('static'),
    define: {
        __ANDROID__: true,
        __ELECTRON__: false
    }
})

module.exports = config
