const SwsProcessorKoa = require('./swsProcessorKoa')
const swsUtil = require('./swsUtil')
const path = require('path')
const fs = require('fs')
let swsProcessorkoa = null;

// swagger-stats default options
let swsOptions = {
    version: '',
    swaggerSpec: null,
    uriPath: '/swagger-stats',
    durationBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    requestSizeBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    responseSizeBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    apdexThreshold: 25,
    onResponseFinish: null,
    authentication: false,
    sessionMaxAge: 900,
    onAuthenticate: null,
    elasticsearchIndex: null
};

let uiMarkup = swsUtil.swsEmbeddedUIMarkup;

let pathUI = swsOptions.uriPath + '/ui';
let pathDist = swsOptions.uriPath + '/dist';
let pathStats = swsOptions.uriPath + '/stats';
let pathMetrics = swsOptions.uriPath + '/metrics';
let pathLogout = swsOptions.uriPath + '/logout';

function handleRequest(ctx) {
    console.log('handleRequest')
    try {
        swsProcessorkoa.processorRequest(ctx);
    } catch (error) {

        console.log(error)
    }
}

function handleResponse(ctx) {

    try {
        swsProcessorkoa.processorResponse(ctx);
    } catch (error) {
        console.log(error)
    }
}





module.exports = {

    getMiddleware(options) {

        processOptions(options);

        swsProcessorkoa = new SwsProcessorKoa();
        swsProcessorkoa.init(options)

        return async function(ctx, next) {
            if (ctx.url.startsWith(pathStats)) {
                return processGetStats(ctx);
            } else if (ctx.url.startsWith(pathMetrics)) {
                return processGetMetrics(ctx);
            } else if (ctx.url.startsWith(pathLogout)) {
                // processLogout(ctx);
                return;
            } else if (ctx.url.startsWith(pathUI)) { // load index.html
                ctx.status = 200
                ctx.body = uiMarkup;
                return;
            } else if (ctx.url.startsWith(pathDist)) { // load static file source
                var fileName = ctx.url.replace(pathDist + '/', '');
                var qidx = fileName.indexOf('?');
                if (qidx != -1) fileName = fileName.substring(0, qidx);
                let filePath = path.join(__dirname, '..', 'dist', fileName);
                let content = fs.readFileSync(filePath, 'binary')
                ctx.res.writeHead(200)
                ctx.res.write(content, 'binary')
                ctx.res.end()
                return;
            }
            handleRequest(ctx);
            await next()
            handleResponse(ctx);
        }

    }
}


// Override defaults if options are provided
function processOptions(options) {
    if (!options) return;
    for (var op in swsUtil.supportedOptions) {
        if (op in options) {
            swsOptions[op] = options[op];
        }
    }
    // update standard path
    pathUI = swsOptions.uriPath + '/ui';
    pathDist = swsOptions.uriPath + '/dist';
    pathStats = swsOptions.uriPath + '/stats';
    pathMetrics = swsOptions.uriPath + '/metrics';
    pathLogout = swsOptions.uriPath + '/logout';

    if (swsOptions.authentication) {
        setInterval(expireSessionIDs, 500);
    }
}

async function processGetStats(ctx) {

    ctx.res.writeHead(200)
    var query = {};
    for (let key in ctx.request.query) {
        query['fields'] = ctx.request.query[key]
    };
    let content = swsProcessorkoa.getStats(query);
    console.log(content)
    ctx.body = content

}

function processGetMetrics(ctx) {
    ctx.res.writeHead(200)
        // ctx.res.set('Content-Type', 'text/plain');
        // ctx.res.end(promClient.register.metrics());
}