const SwsProcessorKoa = require('./swsProcessorKoa')
const swsUtil = require('./swsUtil')
const path = require('path')
const fs = require('fs')
const cluster = require('cluster');
let swsProcessorkoa = null;
const SwsProcessorByCluster = require('./swsProcessorByCluster')

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
    try {
        if (cluster.isMaster) {
            swsProcessorkoa.processorRequest(ctx);
        } else {
            swsProcessorkoa.processorRequestByCluster(ctx);
        }
    } catch (error) {
        console.log(error)
    }
}

function handleResponse(ctx) {
    try {
        if (cluster.isMaster) {
            swsProcessorkoa.processorResponse(ctx);
        } else {
            swsProcessorkoa.processorResponseByCluster(ctx);
        }
    } catch (error) {
        console.log(error)
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

    // ctx.res.writeHead(200)
    var query = {};

    for (let key in ctx.request.query) {
        query['fields'] = ctx.request.query[key]
    };
    let content = {}
    if (!cluster.isMaster) {
        await new Promise((resolve, reject) => {
            process.send({ query: query, type: "getStats", id: cluster.worker.id, pid: process.pid })
            process.on('message', function(msg) {
                if (msg.type == "getStatsCallback") {
                    content = msg.content;
                    // 合并数据
                    resolve(true)
                }
            })
        })

    } else {
        content = swsProcessorkoa.getStats(query);
    }
    ctx.body = content;
}

function processGetMetrics(ctx) {
    ctx.res.writeHead(200);
    // ctx.res.set('Content-Type', 'text/plain');
    // ctx.res.end(promClient.register.metrics());
}


module.exports = {
    getMiddleware(options) {
        processOptions(options);
        if (cluster.isMaster) { //非集群模式的话开启
            swsProcessorkoa = new SwsProcessorKoa();
            swsProcessorkoa.init(options)
        } else { // 集群模式下
            swsProcessorkoa = new SwsProcessorByCluster()
        }
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

    },
    clusterSws(options = {}) { // 集群模式
        processOptions(options);
        swsProcessorkoa = new SwsProcessorKoa();
        swsProcessorkoa.init(options)
            // clusterSwsInit(options)
        cluster.on('online', (worker) => {
            addListenMessage(worker.id)
        });
    }
}



function clusterSwsInit(options) {
    for (const id in cluster.workers) {
        addListenMessage(id)
    }
}


function addListenMessage(id) {
    cluster.workers[id].on('message', function(msg) {
        if (msg.type == "getStats") {
            clusterGetStatsHandle(msg);
        } else if (msg.type == "responseHandle") {
            clusterResponseHandle(msg);
        } else if (msg.type == "getStatsCallback") {
            console.log(msg)
        }

    });
}

function clusterGetStatsHandle(msg) {
    let content = swsProcessorkoa.getStats(msg.query);
    msg.content = content;
    msg.type = "getStatsCallback"
    for (let id in cluster.workers) {
        if (id == msg.id) {
            cluster.workers[id].send(msg)
        }
    }
}



function listenMasterMessage() {
    process.on('message', function(msg) {
        switch (msg.type) {
            case "getStats":
                getStatsToMaster(msg);
            default:
                return;
        }
    })
}

function getStatsToMaster(msg) {
    let content = swsProcessorkoa.getStats(msg.query);
    process.send({ content: content, type: "getStatsCallback", id: cluster.worker.id, pid: process.pid })
}

function clusterResponseHandle(msg) {
    swsProcessorkoa.processorRequestCluster(msg.ctx)
    swsProcessorkoa.processorResponse(msg.ctx)
}