module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    const nem = require("nem2-sdk")
    const crypto = require("crypto")
    const jssha3 = require('js-sha3')
    const sha3_512 = jssha3.sha3_512
    const rx = require('rxjs')
    const op = require('rxjs/operators')

    context.res = {
        // status: 200, /* Defaults to 200 */
        body: "Hello World!"
    };
    context.done();
};