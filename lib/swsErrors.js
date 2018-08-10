/**
 * Created by sv2 on 2/18/17.
 * Errors stats
 */

'use strict';

var util = require('util');
var debug = require('debug')('sws:errors');
var swsUtil = require('./swsUtil');

function swsErrors() {


    // Store counts per each error code
    this.statuscode_count = {};

    // Store Top not found path
    this.top_not_found = {};

    // Store Top server error path
    this.top_server_error = {};
}

swsErrors.prototype.getStats = function() {
    return { statuscode: this.statuscode_count, topnotfound: this.top_not_found, topservererror: this.top_server_error };
};

// Add information about error
swsErrors.prototype.countResponse = function(ctx) {
    if (!swsUtil.isError(ctx.response.status)) return;

    // Increase count by code
    if (!(ctx.response.status in this.statuscode_count)) {
        this.statuscode_count[ctx.response.status] = 0;
    }
    this.statuscode_count[ctx.response.status]++;

    if (ctx.response.status == 404) {
        this.countPathHit(ctx.req.originalUrl, this.top_not_found);
    } else if (ctx.response.status == 500) {
        this.countPathHit(ctx.req.originalUrl, this.top_server_error);
    }

};

// Check if this qualifies as longest request, and store is yes
swsErrors.prototype.countPathHit = function(path, store) {
    if (!(path in store)) {
        store[path] = 0;
    }
    store[path]++;
};


module.exports = swsErrors;