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

    if (req.body && req.body.send && req.body.recieve && req.body.amount) {
        context.log("sender: " + req.body.send)
        context.log("recipient: " + req.body.recieve)
        context.log("amount: " + req.body.amount)
        context.log("pubkey: " + req.body.pubkey)
    } else {
        context.res = {
            status: 400,
            body: "Please pass send, recieve, amount and pubkey in the request body"
        };
        context.done();
        return;
    }
    
    const privRecipient = nem.Address.createFromRawAddress(req.body.recieve)
    const pubSender = nem.Address.createFromRawAddress(req.body.send)
    const amount = req.body.amount
    const pubSenderPublicAccount = nem.PublicAccount.createFromPublicKey(req.body.pubkey)

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

    const txAmount = amount * 100000
    const random = crypto.randomBytes(10);
    const hash = sha3_512.create();
    const secret = hash.update(random).hex().toUpperCase();
    const proof = random.toString('hex');

    const innerTx1pub = nem.SecretLockTransaction.create(
        nem.Deadline.create(),
        new nem.Mosaic(new nem.MosaicId('nem:xem'), nem.UInt64.fromUint(txAmount)),
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

    const tx1pub = nem.AggregateTransaction.createBonded(
        nem.Deadline.create(),
        [
            innerTx1pub.toAggregate(pubSenderPublicAccount),
            dummy.toAggregate(pubHostAccount.publicAccount),
        ],
        NETWORK_TYPE
    )
    const signedTx1pub = pubHostAccount.sign(tx1pub)
    const lockFundsTx1pub = nem.LockFundsTransaction.create(
        nem.Deadline.create(),
        nem.XEM.createRelative(10),
        nem.UInt64.fromUint(480),
        signedTx1pub,
        NETWORK_TYPE
    )
    const signedLockFundsTx1pub = pubHostAccount.sign(lockFundsTx1pub)

    const tx1priv = nem.SecretLockTransaction.create(
        nem.Deadline.create(),
        new nem.Mosaic(new nem.MosaicId('nem:xem'), nem.UInt64.fromUint(txAmount)),
        nem.UInt64.fromUint(80*60),
        nem.HashType.SHA3_512,
        secret,
        pubSender,
        NETWORK_TYPE
    )
    const signedTx1priv = privHostAccount.sign(tx1priv)


    context.log(`tx1pub.hash    : ${signedTx1pub.hash}`)
    context.log(`tx1pub.signer  : ${signedTx1pub.signer}`)
    context.log(`tx1pub(lf).hash: ${signedLockFundsTx1pub.hash}`)

    context.log(`tx1priv: ${signedTx1priv.hash}`)

    const pubPromise = pubChain.listener.open()
    const privPromise = privChain.listener.open()

    Promise.all([pubPromise, privPromise]).then(() => {
        

        pubChain.listener
        .status(pubSender)
        .pipe()
        .subscribe(x => context.log(x), err => context.log.error(err));

        pubChain.listener
        .status(pubHostAccount.address)
        .pipe()
        .subscribe(x => context.log(x), err => context.log.error(err));

        privChain.listener
        .status(privRecipient)
        .pipe()
        .subscribe(x => context.log(x), err => context.log.error(err));

        privChain.listener
        .status(privHostAccount.address)
        .pipe()
        .subscribe(x => context.log(x), err => context.log.error(err));

    }).then(() => {

        privChain.transactionHttp
        .announce(signedTx1priv)
        .subscribe(x => context.log(x), err => context.log.error(err));
        
        pubChain.transactionHttp
        .announce(signedLockFundsTx1pub)
        .subscribe(x => context.log(x), err => context.log.error(err));
        
        pubChain.listener
        .confirmed(pubHostAccount.address)
        .pipe(
            op.filter((transaction) => transaction.transactionInfo !== undefined
                && transaction.transactionInfo.hash === signedLockFundsTx1pub.hash),
            op.mergeMap(ignored => pubChain.transactionHttp.announceAggregateBonded(signedTx1pub))
        )
        .subscribe(x => context.log(x), err => context.log.error(err));
        try{
            const saveData = {
                secret: secret,
                proof: proof,
                tx1pubHash: signedTx1pub.hash,
                tx1pubSigner: signedTx1pub.signer,
                tx1pubLockFundsHash: signedLockFundsTx1pub.hash,
                tx1priv: signedTx1priv.hash
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
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: {
                secret: secret,
                tx1pubHash: signedTx1pub.hash,
                tx1pubSigner: signedTx1pub.signer,
                tx1pubLockFundsHash: signedLockFundsTx1pub.hash,
                tx1priv: signedTx1priv.hash
            }
        };
        context.done();
        
    })



};