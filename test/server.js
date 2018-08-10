const Koa = require('koa')
const app = new Koa();
var swStats = require('./../lib');
// var apiSpec = require('swagger.json');
app.use(swStats.getMiddleware({
    elasticsearch: "http://10.40.2.89:9200",
    elasticsearchIndex: "testIndex"
}));
app.use(async ctx => {
    ctx.body = 'Hello World';
});


app.listen(4040);