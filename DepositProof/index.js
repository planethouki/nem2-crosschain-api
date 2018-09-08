module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    const nem = require("nem2-sdk")

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
    const getTxPubStatus = (txpubHash) => {
        return new Promise((resolve, reject) => {
            pubChain.transactionHttp.getTransactionStatus(txpubHash).subscribe(
                x => resolve(x),
                err => reject(err)
            )
        })
    }

    const sendProofTx = (secret, proof, account, transactionHttp) => {
        return new Promise((resolve, reject) => {
            const tx = nem.SecretProofTransaction.create(
                nem.Deadline.create(),
                nem.HashType.SHA3_512,
                secret,
                proof,
                NETWORK_TYPE
            );
            const signedTx = account.sign(tx)
            transactionHttp.announce(signedTx).subscribe(
                x => resolve({ "TransactionAnnounceResponse": x, "hash": signedTx.hash }),
                err => reject({ "error": err, "hash": signedTx.hash })
            )
        })
    }

    const exec = async (secret) => {
        const data = await getDataFromBlob(secret)
        context.log("checking tx2pub cosigned: " + data.tx2pubHash)
        const tx2pubStatus = await getTxPubStatus(data.tx2pubHash).catch((e) => {
            context.log("tx1pub has not cosigned yet")
            context.res = {
                status: 400,
                body: {
                    message: "tx not confirmed",
                    tx2pubHash: data.tx2pubHash
                }
            };
            context.done();
            return;
        })
        context.log("tx2pub status: " + tx2pubStatus.group)
        if (tx2pubStatus.group !== "confirmed") {
            context.log("tx1pub has not cosigned yet")
            context.res = {
                status: 400,
                body: {
                    message: "tx not confirmed",
                    tx2pubHash: data.tx2pubHash
                }
            };
            context.done();
            return;
        }
        const sendProofTxPub = sendProofTx(secret, data.proof, pubHostAccount, pubChain.transactionHttp)
        const sendProofTxPriv = sendProofTx(secret, data.proof, privHostAccount, privChain.transactionHttp)

        const resultTx3pub = await sendProofTxPub
        const resultTx4priv = await sendProofTxPriv

        context.log(resultTx3pub)
        context.log(resultTx4priv)
        
        context.res = {
            status: 200,
            body: { 
                tx3pubHash: resultTx3pub.hash,
                tx4privHash: resultTx4priv.hash,
                proof: data.proof
            }
        };
        context.done();
        return;
        
    }




    if (!(req.body && req.body.secret)) {
        context.res = {
            status: 400,
            body: {
                message: "Please pass secret in the request body"
            }
        };
        context.done();
        return;
    }
    const secret = req.body.secret;

    context.log("secret: " + secret)

    exec(secret)
};