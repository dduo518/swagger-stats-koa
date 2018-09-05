### 基于 swsagger-stats(http://swaggerstats.io/)  （express版本）改造koa版本
#### 具体使用可看 原项目地址 （https://github.com/slanatech/swagger-stats）
#### koa项目中使用方式
##### 直接下载项目之后应用lib目录下的index 文件
##### example 
```
const Koa = require('koa')
const app = new Koa();
const bodyParser = require('koa-bodyparser')
var swStats = require('./../lib');
const router = require('koa-router')()
    // 配置ctx.body解析中间件
app.use(bodyParser())

// var apiSpec = require('swagger.json');
app.use( swStats.getMiddleware({
    elasticsearch: "http://10.40.2.89:9200"
}));


router.post('/api', async ctx => {
    ctx.body = {
        success: true,
        data: {
            api: "1111"
        }
    }
})


router.get('/apiget', async ctx => {
    ctx.body = {
        success: true,
        data: {
            api: "1111"
        }
    }
})

app.use(router.routes()).use(router.allowedMethods())
app.listen(4040, '0.0.0.0');
```
### 如果在集群模式下启动
```
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const sws = require('./../lib');
if (cluster.isMaster) {
    console.log(`主进程 ${process.pid} 正在运行`);
    // 衍生工作进程。
    let child;
    for (let i = 0; i < numCPUs; i++) {
        child = cluster.fork();
    }
    sws.clusterSws()
    cluster.on('exit', (worker, code, signal) => {
        cluster.fork();
        console.log(`工作进程 ${worker.process.pid} 已退出`);
    });

} else {
    require('./server')
    console.log(`工作进程 ${process.pid} 已启动`);
}
```