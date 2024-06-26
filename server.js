import http from 'http'
import path from 'path'
import fs from 'fs'

const HOSTNAME = '127.0.0.1'
const PORT = '8000'

const MIME_TYPES = {
    default: 'application/octet-stream',
    html: 'text/html; charset=UTF-8',
    js: 'application/javascript',
}

const STATIC_PATH = process.cwd()

const toBool = [ () => true, () => false ]

async function prepareFile(url) {
    const paths = [STATIC_PATH, url]

    if (url.endsWith('/')) {
        console.log('HAHAHAHAHA')
        paths.push('index.html')
    }

    const filePath = path.join(...paths)
    const pathTraversal = !filePath.startsWith(STATIC_PATH)
    const exists = await fs.promises.access(filePath).then(...toBool)
    const found = !pathTraversal && exists
    const streamPath = found ? filePath : STATIC_PATH + '/404.html'
    const ext = path.extname(streamPath).substring(1).toLowerCase()
    const stream = fs.createReadStream(streamPath)

    return { found, ext, stream }
}

const server = http.createServer(async (req, res) => {
    const file = await prepareFile(req.url)
    const statusCode = file.found ? 200 : 404
    const mimeType = MIME_TYPES[file.ext] ?? MIME_TYPES.default

    res.writeHead(statusCode, { 'Content-Type': mimeType })
    file.stream.pipe(res)
    console.log(`${req.method} ${req.url} ${statusCode}`)
})

server.listen(PORT, HOSTNAME, () => {
    console.log(`listening on http://${HOSTNAME}:${PORT}`)
})
