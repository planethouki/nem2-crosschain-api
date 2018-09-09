module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    const nem = require("nem2-sdk")
    const rx = require('rxjs')
    const op = require('rxjs/operators')
    
    const NETWORK_TYPE = nem.NetworkType.MIJIN_TEST

    const API_URL_PRIVATE = process.env.API_URL_PRIVATE
    const API_URL_PUBLIC = process.env.API_URL_PUBLIC

    const privChain = {
        accountHttp: new nem.AccountHttp(API_URL_PRIVATE),
    }

    const pubChain = {
        accountHttp: new nem.AccountHttp(API_URL_PUBLIC),
    }

    const getAccountInfo = (address, accountHttp) => {
        return new Promise((resolve, reject) => {
            accountHttp.getAccountInfo(address).subscribe(
                x => resolve(x),
                err => reject(err)
            )
        })
    }

    const createFromRawAddress = (rawAddress) => {
        return new Promise((resolve, reject) => {
            try {
                resolve(nem.Address.createFromRawAddress(rawAddress));
            } catch (e) {
                reject(e);
            }
        })
    }


    const exec = async (rawAddress) => {
        const address = await createFromRawAddress(rawAddress).catch((e) => {
            context.log.error(e);
            context.res = {
                status: 400,
                body: {
                    message: "address format incollect"
                }
            };
            context.done();
            return;
        });
        const accountInfoPub = await getAccountInfo(address, pubChain.accountHttp).catch((e) => {
            context.log.warn(e);
        })
        const accountInfoPriv = await getAccountInfo(address, privChain.accountHttp).catch((e) => {
            context.log.warn(e);
        })
        context.log(accountInfoPub);
        context.log(accountInfoPriv);

        if (accountInfoPub === undefined && accountInfoPriv === undefined) {
            context.res = {
                status: 404,
                body: {
                    message: "public key not found"
                }
            };
            context.done();
            return;
        }

        const pubkeyPub = accountInfoPub && accountInfoPub.publicKey;
        const pubkeyPriv = accountInfoPriv && accountInfoPriv.publicKey;

        const isInvalidPub = (pubkeyPub == "0000000000000000000000000000000000000000000000000000000000000000" || pubkeyPub === undefined);
        const isInvalidPriv = (pubkeyPriv == "0000000000000000000000000000000000000000000000000000000000000000" || pubkeyPriv === undefined);

        if (isInvalidPub && isInvalidPriv) {
            context.res = {
                status: 400,
                body: {
                    message: "public key is zero value"
                }
            };
            context.done();
            return;
        }

        if (!isInvalidPub && !isInvalidPriv) {
            if (pubkeyPub !== pubkeyPriv) {
                context.res = {
                    status: 400,
                    body: {
                        message: "something wrong. address has two public key?"
                    }
                };
                context.done();
                return;
            }
        }

        context.res = {
            status: 200,
            body: {
                publicKey: isInvalidPub ?  pubkeyPriv : pubkeyPub
            }
        };
        context.done();
    }

    if (!(req.query.address || (req.body && req.body.address))) {
        context.res = {
            status: 400,
            body: {
                message: "Please pass a address on the query string or in the request body"
            }
        };
        context.done();
        return;
    }

    exec(req.query.address || req.body.address);
    
};