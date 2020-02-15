var express = require('express')
const https = require('https')
const zlib = require("zlib")
const fs = require("fs")
const cookiejar = require('cookiejar')
const {CookieAccessInfo, CookieJar, Cookie} = cookiejar
const path = require('path')
var Proxy = require('./Proxy')

let config = {
    httpprefix: 'https', port: 443,
    serverName: 'siteproxy.now.sh',
}
if (process.env.localFlag === 'true') {
    config.httpprefix = 'http'
    config.port = '8011'
    config.serverName = '127.0.0.1'
}

let {httpprefix, serverName, port, accessCode} = config

const locationReplaceMap302 = { // when we have redirect(302) code received, we need to modify the location header
  'http://([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-zA-Z0-9]+?)': `${httpprefix}://${serverName}:${port}/http/$1`,
  'https://([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-zA-Z0-9]+?)': `${httpprefix}://${serverName}:${port}/https/$1`,
}
const regReplaceMap = {
  // 'https://(.+?).ytimg.(.+?)/': `http://${serverName}:${port}/https/$1.ytimg.$2/`,
  // '"(./)error_204?)': `"$1https\/www.youtube.com\/error_204?`,
  '"//([-a-z0-9]+?\.[a-z]+?\.[a-z]+?)': `"//${serverName}:${port}/https/$1`,
  '\'//([-a-z0-9]+?\.[a-z]+?\.[a-z]+?)': `'//${serverName}:${port}/https/$1`,
  'url[(]//([-a-z0-9]+?\.[a-z]+?\.[a-z]+?)': `url(//${serverName}:${port}/https/$1`,
  'http:([\]/[\]/)([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-z0-9A-Z]+?)': `${httpprefix}:$1${serverName}:${port}/http/$2`,
  'http://([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-zA-Z0-9]+?)': `${httpprefix}://${serverName}:${port}/http/$1`,
  'https:([\]/[\]/)([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-z0-9A-Z]+?)': `${httpprefix}:$1${serverName}:${port}/https/$2`,
  'https://([-a-z0-9A-Z]+?\.[a-z0-9A-Z]+?\.[-a-zA-Z0-9]+?)': `${httpprefix}://${serverName}:${port}/https/$1`,
}
const siteSpecificReplace = {
    'www.google.com': {
        '(s=.)/images/': `$1/https/www.google.com/images/`,
        '(/xjs/_)':`/https/www.google.com$1`,
        '/images/branding/googlelogo': `/https/www.google.com/images/branding/googlelogo`,
   //      '/search\?"': `/https/www.google.com/search?"`,
        '"(/gen_204\?)': `"/https/www.google.com$1`,
        '"(www.gstatic.com)"': `"${httpprefix}://${serverName}:${port}/https/$1"`,
        'J+"://"': `J+"://${serverName}:${port}/https/"`,
    },
    'www.youtube.com': {
        '/manifest.json': `/https/www.youtube.com/manifest.json`,
        '("url":")/([-a-z0-9]+?)': `$1/https/www.youtube.com/$2`,
        // ';this...logo.hidden=!0;': ';',
        // '&&this...': '&&this.$&&this.$.',
    },
    'wikipedia.org': {
    },
    'wikimedia.org': {
    }
}
const pathReplace = ({host, httpType, body}) => {
    let myRe = new RegExp('href="[.]?/([-a-z0-9]+?)', 'g')
    body = body.replace(myRe, `href="/${httpType}/${host}/$1`)

    myRe = new RegExp(' src=(["\'])/([-a-z0-9]+?)', 'g')
    body = body.replace(myRe, ` src=$1/${httpType}/${host}/$2`)

    myRe = new RegExp('([: ]url[(]["]?)/([-a-z0-9]+?)', 'g')
    body = body.replace(myRe, `$1/${httpType}/${host}/$2`)

    myRe = new RegExp(' action="/([-a-z0-9A-Z]+?)', 'g')
    body = body.replace(myRe, ` action="/${httpType}/${host}/$1`)

    return body
}

let app = express()
let cookieDomainRewrite = serverName

let proxy = Proxy({cookieDomainRewrite, locationReplaceMap302, regReplaceMap, siteSpecificReplace, pathReplace})

app.use((req, res, next) => {
  console.log(`req.url:${req.url}`)

  if (req.url === `/bg-gr-v.png`) {
    body = fs.readFileSync(path.join(__dirname, './bg-gr-v.png'))
    res.status(200).send(body)
    return
  } else
  if (req.url === `/style.css`) {
    body = fs.readFileSync(path.join(__dirname, './style.css'), encoding='utf-8')
    res.status(200).send(body)
    return
  } else
  if (req.url === '/' || req.url === '/index.html') {
    body = fs.readFileSync(path.join(__dirname, './index.html'), encoding='utf-8')
    res.status(200).send(body)
    return
  }
  next()
})

app.use(proxy)

app.listen(port)

console.log(`listening on port:${port}`)
