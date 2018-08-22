module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    const nem = require("nem2-sdk")
    const crypto = require("crypto")
    const jssha3 = require('js-sha3')
    const sha3_512 = jssha3.sha3_512
    const rx = require('rxjs')
    const op = require('rxjs/operators')

    const NETWORK_TYPE = nem.NetworkType.MIJIN_TEST

    const API_URL_PRIVATE = process.env.API_URL_PRIVATE
    const API_URL_PUBLIC = process.env.API_URL_PUBLIC

    const privHostAccount = nem.Account.createFromPrivateKey(process.env.HOST_PRIVATEKEY_PRIVATE, NETWORK_TYPE)
    const pubHostAccount = nem.Account.createFromPrivateKey(process.env.HOST_PRIVATEKEY_PUBLIC, NETWORK_TYPE)

    
    const privChain = {
        accountHttp: new nem.AccountHttp(API_URL_PRIVATE),
        blockchainHttp: new nem.BlockchainHttp(API_URL_PRIVATE),
        mosaicHttp: new nem.MosaicHttp(API_URL_PRIVATE),
        namespaceHttp: new nem.NamespaceHttp(API_URL_PRIVATE),
        transactionHttp: new nem.TransactionHttp(API_URL_PRIVATE),
        listener: new nem.Listener(API_URL_PRIVATE),
        mosaicService: null,
    }
    privChain.mosaicService = new nem.MosaicService(privChain.accountHttp, privChain.mosaicHttp, privChain.namespaceHttp)

    const pubChain = {
        accountHttp: new nem.AccountHttp(API_URL_PUBLIC),
        blockchainHttp: new nem.BlockchainHttp(API_URL_PUBLIC),
        mosaicHttp: new nem.MosaicHttp(API_URL_PUBLIC),
        namespaceHttp: new nem.NamespaceHttp(API_URL_PUBLIC),
        transactionHttp: new nem.TransactionHttp(API_URL_PUBLIC),
        listener: new nem.Listener(API_URL_PUBLIC),
        mosaicService: null,
    }
    pubChain.mosaicService = new nem.MosaicService(pubChain.accountHttp, pubChain.mosaicHttp, pubChain.namespaceHttp)
    
    const getDataFromBlob = (blobname) => {
        return new Promise((resolve, reject) => {
            const storage = require('azure-storage');
            const blobService = storage.createBlobService(process.env.AzureWebJobsStorage);
            blobService.getBlobToText("atomicswap-secret", blobname, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(data));
                }
            })
        })
    }
    const checkCosign = (tx1pubHash) => {
        return new Promise((resolve, reject) => {
            pubChain.transactionHttp.getTransactionStatus(tx1pubHash).subscribe(x => resolve(x))
        })
    }

    const createTxs = (secret, proof) =>{
        return new Promise((resolve, reject) => {
            const tx2pub = nem.SecretProofTransaction.create(
                nem.Deadline.create(),
                nem.HashType.SHA3_512,
                secret,
                proof,
                NETWORK_TYPE
            );
            const signedTx2pub = pubHostAccount.sign(tx2pub)

            const tx2priv = nem.SecretProofTransaction.create(
                nem.Deadline.create(),
                nem.HashType.SHA3_512,
                secret,
                proof,
                NETWORK_TYPE
            );
            const signedTx2priv = privHostAccount.sign(tx2priv)
            resolve({"signedTx2pub": signedTx2pub, "signedTx2priv": signedTx2priv})
        })
    }
    
    const announceTx = (tx, transactionHttp) => {
        return new Promise((resolve, reject) => {
            transactionHttp.announce(tx).subscribe(
                x => resolve(x),
                err => reject(err)
            )
        })
    }

    const exec = async (secret) => {
        const data = await getDataFromBlob(secret)
        context.log("checking tx1pub cosigned: " + data.tx1pubHash)
        const tx1pubStatus = await checkCosign(data.tx1pubHash)
        if (tx1pubStatus.group !== "confirmed") {
            context.log("tx1pub has not cosigned yet")
            context.res = {
                status: 400,
                body: "tx not confirmed"
            };
            context.done();
            return;
        }
        context.log("create secret proof tx")
        const txs = await createTxs(secret, data.proof)
        context.log("announce txs")
        const announcePub = announceTx(txs.signedTx2pub, pubChain.transactionHttp)
        const announcePriv = announceTx(txs.signedTx2priv, privChain.transactionHttp)
        [await announcePub, await announcePriv].map(context.log)
        context.res = {
            status: 200,
            body: "OK"
        };
        context.done();
        return;
        
    }




    if (!(req.body && req.body.secret)) {
        context.res = {
            status: 400,
            body: "Please pass secret in the request body"
        };
        context.done();
        return;
    }
    const secret = req.body.secret;

    context.log("secret: " + secret)

    exec(secret)
};