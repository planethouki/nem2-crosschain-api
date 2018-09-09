# nem2-crosschain-api

## Overview

- Catapult crosschain transaction demo.
- Using Azure Functions.

## Todo

- DepositLock robustness.
- Should it return proof?
- Description.

## Endpoints

### deposit/lock

Request

```json
{
  "tx1privRecipient": "SB2Y5ND4FDLBIO5KHXTKRWODDG2QHIN73DTYT2PC",
  "tx2pubSigner": "1C650F49DD67EC50BFDEA40906D32CDE3C969BDF58837C7DA320829BDDE96150",
  "tx1privMosaic": "nem:xem::1000000",
  "tx2pubMosaic": "nem:xem::1000000"
}
```

Response

```json
{
  "secret": "02961347D134408118F9F73363770F8DDBF28A96AAFEABC4D9708681EFC882B8AF51A4EC4B4D9D9D2504191C1CD4E6A21805355500A0CECAC7C013549EBC8BF9",
  "tx2pubHash": "E3A5C4920E073BFC352799A9DF3AB2899FA629C21B9B42A413D3B33A9FA6B73E",
  "tx2pubLockFundsHash": "59E9778191D5B176F4D52F8C10B62154850B0A35CE105130EBD0653780B826D9",
  "tx1privHash": "93D549D9844E4ECC1064D634ECFDCA2ADE5A04EDDDD3AD6020FBAAAE69702D28"
}
```


### deposit/proof

Request

```json
{
    "secret": "02961347D134408118F9F73363770F8DDBF28A96AAFEABC4D9708681EFC882B8AF51A4EC4B4D9D9D2504191C1CD4E6A21805355500A0CECAC7C013549EBC8BF9"
}
```

Response

```json
{
  "tx3pubHash": "5BCB4C0A2BD07F7A0CCE8525DCF3E3D016A9CD0FD175B9DD27D0BB91F548B74D",
  "tx4privHash": "699FDB90C17FDA8252D269F10A4F2CF2C1171AAA62DEE7986B15554C0697E43F",
  "proof": "9a9d06db17f0d5af55bb"
}
```

### publickey

Request

```json
{
  "address": "SCBCMLVDJBXARCOI6XSKEU3ER2L6HH7UBEPTENGQ"
}

```

Response

```
{
  "publicKey": "1C650F49DD67EC50BFDEA40906D32CDE3C969BDF58837C7DA320829BDDE96150"
}
```

## Azure Functions

### Application Setting (Environment Variables)

| Name | Value | Description |
|:-----|:------|:------------|
| AzureWebJobsStorage | | Azure default |
| API_URL_PRIVATE | | Your own catapult network like http://example.com:3000 |
| API_URL_PUBLIC | | Another catapult network like http://example.com:3000 | |
| HOST_PRIVATEKEY_PRIVATE | | Private key you send mosaics at your network |
| HOST_PRIVATEKEY_PUBLIC | | Private key you receive mosaics at anothoer network |
| WEBSITE_NODE_DEFAULT_VERSION | 10.6.0 | |
| FUNCTIONS_EXTENSION_VERSION | beta | |

### Library Setting

Install nem2-sdk-typescript-javascript

## Azure BLOB

Make Container named "atomicswap-secret"

## Run locally

clone this repository.

Open in Visual Studio Code.

Install Azure Functinos extension.

Rename `local.settings.json.sample` to `local.settings.json`, and fill blank.

Press F5 to start.

https://docs.microsoft.com/ja-jp/azure/azure-functions/functions-develop-local