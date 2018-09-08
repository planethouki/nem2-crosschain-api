# nem2-crosschain-api

## Overview

- Catapult crosschain transaction demo.
- Using Azure Functions.

## Todo

- DepositLock robustness.
- Should it return proof ?

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

