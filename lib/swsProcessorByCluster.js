const SwsProcessor = require("./swsProcessorKoa")
const cluster = require('cluster');

module.exports = class swsProcessorByCluster extends SwsProcessor {

    constructor() {
        super();
    }

    // in cluster it  resolve data 
    processorRequestByCluster(ctx) {
        ctx = this.resolveData(ctx)
        // ctx = this.pkgCtx(ctx)
    }

    // 集群模式下 对响应进行封装
    processorResponseByCluster(ctx) {
        // send data to master 
        var pkgCtx = {
            sws: ctx.sws,
            originalUrl: ctx.originalUrl,
            method: ctx.method,
            req: {
                method: ctx.method
            },
            response: {
                status: ctx.response.status
            },
            request: {
                url: ctx.request.url,
                query: ctx.request.query,
                body: ctx.request.body,
                params: ctx.request.params
            },
            query: ctx.query,
            headers: ctx.headers || ctx.response.headers
        }

        var resContentLength = 0;

        if ("_contentLength" in ctx && ctx['_contentLength'] !== null) {
            resContentLength = ctx['_contentLength'];
        } else {
            // Try header
            if (ctx.response['length'] !== null) {
                resContentLength = parseInt(ctx.response['length'] || 0);
            }
        }

        process.send({ ctx: pkgCtx, sws: ctx.sws, type: "responseHandle", id: cluster.worker.id, pid: process.pid })
    }
}