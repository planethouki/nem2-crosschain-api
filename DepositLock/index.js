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

    if (req.body && req.body.tx2pubSigner && req.body.tx1privRecipient && req.body.tx1privMosaic && req.body.tx2pubMosaic) {
        context.log("tx1privRecipient: " + req.body.tx1privRecipient)
        context.log("tx2pubSigner: " + req.body.tx2pubSigner)
        context.log("tx1privMosaic: " + req.body.tx1privMosaic)
        context.log("tx2pubMosaic: " + req.body.tx2pubMosaic)
    } else {
        context.log.error(req.body ? req.body : "req.body not found");
        context.res = {
            status: 400,
            body: "Please pass send, receive, amount and pubkey in the request body"
        };
        context.done();
        return;
    }
    
    const tx2pubSenderPublicAccount = nem.PublicAccount.createFromPublicKey(req.body.tx2pubSigner)
    const tx1privRecipient = nem.Address.createFromRawAddress(req.body.tx1privRecipient)
    const tx2pubSender = tx2pubSenderPublicAccount.address
    const tx1privMosaic = req.body.tx1privMosaic
    const tx2pubMosaic = req.body.tx2pubMosaic

    const tx1privMosaicParts = tx1privMosaic.split('::');
    const tx2pubMosaicParts = tx2pubMosaic.split('::');

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

    const random = crypto.randomBytes(10);
    const hash = sha3_512.create();
    const secret = hash.update(random).hex().toUpperCase();
    const proof = random.toString('hex');

    
    const tx1priv = nem.SecretLockTransaction.create(
        nem.Deadline.create(),
        new nem.Mosaic(new nem.MosaicId(tx1privMosaicParts[0]), nem.UInt64.fromUint(+tx1privMosaicParts[1])),
        nem.UInt64.fromUint(80*60),
        nem.HashType.SHA3_512,
        secret,
        tx1privRecipient,
        NETWORK_TYPE
    )
    const signedTx1priv = privHostAccount.sign(tx1priv)


    const innerTx2pub = nem.SecretLockTransaction.create(
        nem.Deadline.create(),
        new nem.Mosaic(new nem.MosaicId(tx2pubMosaicParts[0]), nem.UInt64.fromUint(+tx2pubMosaicParts[1])),
        nem.UInt64.fromUint(96*60),
        nem.HashType.SHA3_512,
        secret,
        pubHostAccount.address,
        NETWORK_TYPE
    )
    const dummy = nem.TransferTransaction.create(
        nem.Deadline.create(),
        pubHostAccount.address,
        [new nem.Mosaic(new nem.MosaicId('nem:xem'), nem.UInt64.fromUint(0))],
        nem.PlainMessage.create('dummy'),
        NETWORK_TYPE
    );

    const tx2pub = nem.AggregateTransaction.createBonded(
        nem.Deadline.create(),
        [
            innerTx2pub.toAggregate(tx2pubSenderPublicAccount),
            dummy.toAggregate(pubHostAccount.publicAccount),
        ],
        NETWORK_TYPE
    )
    const signedTx2pub = pubHostAccount.sign(tx2pub)
    const lockFundsTx2pub = nem.LockFundsTransaction.create(
        nem.Deadline.create(),
        nem.XEM.createRelative(10),
        nem.UInt64.fromUint(480),
        signedTx2pub,
        NETWORK_TYPE
    )
    const signedLockFundsTx2pub = pubHostAccount.sign(lockFundsTx2pub)

    context.log(`tx1priv: ${signedTx1priv.hash}`)
    context.log(`tx2pub.hash    : ${signedTx2pub.hash}`)
    context.log(`tx2pub.signer  : ${signedTx2pub.signer}`)
    context.log(`tx2pub(lf).hash: ${signedLockFundsTx2pub.hash}`)

    try{
        const saveData = {
            secret: secret,
            proof: proof,
            tx2pubHash: signedTx2pub.hash,
            tx2pubSigner: signedTx2pub.signer,
            tx2pubCosigner: tx2pubSenderPublicAccount.publicKey,
            tx2pubLockFundsHash: signedLockFundsTx2pub.hash,
            tx1privHash: signedTx1priv.hash
        }
        const storage = require('azure-storage');
        const blobService = storage.createBlobService(process.env.AzureWebJobsStorage);
        blobService.createBlockBlobFromText("atomicswap-secret", secret, JSON.stringify(saveData), (error, result) => {
            if(error) {
                context.log.error(error)
            } else {
                context.log(result)
            }
        });
    } catch(e) {
        context.log.error(e)
    }

    const responseBody = {
        secret: secret,
        tx2pubHash: signedTx2pub.hash,
        tx2pubLockFundsHash: signedLockFundsTx2pub.hash,
        tx1privHash: signedTx1priv.hash
    }

    pubChain.listener.open().then(() => {

        privChain.transactionHttp
        .announce(signedTx1priv)
        .subscribe(x => context.log(x), err => context.log.error(err));
        
        pubChain.transactionHttp
        .announce(signedLockFundsTx2pub)
        .subscribe(x => context.log(x), err => context.log.error(err));
        
        const listenerSubscription = pubChain.listener
        .confirmed(pubHostAccount.address)
        .pipe(
            op.timeout(60*1000),
            op.filter((transaction) => transaction.transactionInfo !== undefined
                && transaction.transactionInfo.hash === signedLockFundsTx2pub.hash),
            op.mergeMap(ignored => pubChain.transactionHttp.announceAggregateBonded(signedTx2pub))
        )
        .subscribe(
            x => {
                context.log(x)
                context.res = {
                    body: responseBody
                };
                pubChain.listener.close();
                listenerSubscription.unsubscribe();
                context.done();
            }, 
            err => {
                context.log.error(err)
                context.res = {
                    status: 500,
                    body: {
                        message: "something error",
                        error: err
                    }
                };
                pubChain.listener.close();
                listenerSubscription.unsubscribe();
                context.done();
            }
        );
    })



};