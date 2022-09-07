const fs = require('fs')
const path = require('path')
// 编译.vue文件
const compilerSfc = require('@vue/compiler-sfc')
const compilerDom = require('@vue/compiler-dom')
const Koa = require('koa')
const app = new Koa()

const JS_TYPE = 'application/javascript'

// 改写一下文件的import导入第三方库时的写法
function rewriteImport(content) {
    return content.replace(/ from ['|"]([^'"]+)['|"]/g, function (s0, s1) {
        // 判断是不是绝对路径,不是就要修改
        if (s1[0] !== '.' && s1[1] !== '/') {
            return ` from '/@modules/${s1}'`
        } else {
            return s0
        }
    })
}

app.use(async ctx => {
    const { url, query } = ctx.request
    console.log('url', url)
    // 处理/
    if (url === '/') {
        ctx.type = 'text/html'
        let content = fs.readFileSync('./index.html', 'utf-8')
        // 加入vue的环境变量,设置为打包好的环境,免得出警告
        content = content.replace('<script',
            `<script>window.process = {env:{NODE_ENV:'production'}}</script><script`)
        ctx.body = content
    }
    // 处理*.vue文件
    else if (url.indexOf('.vue') > -1) {
        const vueFilePath = path.resolve(__dirname, url.split('?')[0].slice(1))
        // 编译.vue文件
        const { descriptor } = compilerSfc.parse(fs.readFileSync(vueFilePath, 'utf-8'))
        if (!query.type) {
            ctx.type = JS_TYPE
            ctx.body = `
            ${rewriteImport(descriptor.script.content.replace('export default', 'const __script = '))}
            import { render as __render } from '${url}?type=template'
            __script.render = __render
            export default __script
            `
        } else {
            const template = descriptor.template
            const render = compilerDom.compile(template.content, { mode: 'module' })
            ctx.type = JS_TYPE
            ctx.body = rewriteImport(render.code)
        }
    }
    // 处理css文件
    else if (url.endsWith('.css')) {
        const cssFilePath = path.resolve(__dirname, url.slice(1))
        const file = fs.readFileSync(cssFilePath, 'utf-8')
        const content = `
        const css = "${file.replaceAll(/\r\n/g, "")}"
        const link = document.createElement('style')
        link.setAttribute('type','text/css')
        document.head.appendChild(link)
        link.innerHTML = css
        export default css
        `
        ctx.type = JS_TYPE
        ctx.body = content
    }
    // 处理 *.js
    else if (url.endsWith('.js')) {
        const jsFilePath = path.resolve(__dirname, url.slice(1))
        const content = fs.readFileSync(jsFilePath, 'utf-8')
        ctx.type = JS_TYPE
        // 要改写一下import第三方库的from内容,欺骗一下浏览器,让浏览器不报错
        ctx.body = rewriteImport(content)
    }
    // 处理第三方库依赖
    else if (url.startsWith('/@modules')) {
        // 找第三方库的位置
        const prefix = path.resolve(__dirname, 'node_modules', url.replace('/@modules/', ''))
        // 读取该库的package.json文件的module属性
        const module = require(prefix + '/package.json').module
        const kuDistPath = path.resolve(prefix, module)
        const content = fs.readFileSync(kuDistPath, 'utf-8')
        ctx.type = JS_TYPE
        // 处理第三方库使用其他库的情况
        ctx.body = rewriteImport(content)
    }
})

app.listen(9999, () => {
    console.log('http://localhost:9999')
})