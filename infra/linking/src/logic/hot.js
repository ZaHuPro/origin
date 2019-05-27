import origin, { web3 } from './../services/origin'
import fetch from 'cross-fetch'
import { TypedDataUtils, concatSig } from 'eth-sig-util'
import ethUtil from 'ethereumjs-util'
import stringify from 'json-stable-stringify'
const HOT_WALLET_PK = process.env.HOT_WALLET_PK


const MIN_FEE = '50000000000000'

const ALLOWED_CALLS = {
  acceptOfferOnBehalf: { feeIndex: 3, minFee: MIN_FEE },
  verifiedOnBehalfFinalize: { feeIndex: 3, minFee: MIN_FEE }
}


class Hot {
  constructor() {
    // grab the version that allows for behalf submits
    this.marketplace_adapter = origin.marketplace.resolver.adapters['A']
    this.account = web3.eth.accounts.wallet.add(HOT_WALLET_PK)
    this.transactionSigner = this.account.signTransaction
    this.initContract()
  }

  async initContract() {
    this.contract = await origin.contractService.deployed(origin.contractService.marketplaceContracts.VB_Marketplace)
  }

  checkMinFee(fee) {
    return web3.utils.toBN(fee).gte(web3.utils.toBN(MIN_FEE))
  }

  isAllowedCall(cmd, params) {
    const call_const = ALLOWED_CALLS[cmd]
    if (call_const) {
      const { feeIndex, minFee } = call_const
      // check to make sure that behalfFee at the parameter spot is greater than or equals to the fee
      // this makes sure that our hot wallet will always get refunded more gas than we put in
      if (web3.utils.toBN(params[feeIndex]).gte(web3.utils.toBN(minFee))) {
        return true
      }
    }
  }
  
  async _submitMarketplace(cmd, params) {
    const from = this.account.address
    console.log('Submitting...', cmd, params, from)
    console.log('Pre market balance...', await web3.eth.getBalance(from))
    const options = { from }
    const method = this.contract.methods[cmd](...params)
    options.gas = (options.gas || (await method.estimateGas(options)))
    console.log("estimated Gas is:", options.gas)
    const transactionReceipt = await new Promise((resolve, reject) => {
      if (this.transactionSigner)
      {
        //This is needed for infura nodes
        options.data = method.encodeABI()
        options.to = this.contract.options.address
        this.transactionSigner(options).then(sig => {
          web3.eth.sendSignedTransaction(sig.rawTransaction).then(receipt => {
            console.log("confirmationReceipt", receipt)
            resolve(receipt)
          })
        })
      } else {
        console.log("calling method...")
        method.send(options).then(receipt => {
          console.log("confirmationReceipt", receipt)
          resolve(receipt)
        })
      }
    })
    const ret = { transactionReceipt }
    console.log('Post market balance...', await web3.eth.getBalance(from))
    return ret
  }

  async submitMarketplace(cmd, params) {
    if (!this.isAllowedCall(cmd, params)) {
      throw new Error(
        `Error cmd:${cmd} params: ${params} is not an allowed call`
      )
    }
    return this._submitMarketplace(cmd, params)
  }

  async verifyProfile(_profile) {
    const profile = Object.assign({}, _profile)
    delete profile.active
    delete profile.raw_ipfs_hash
    delete profile.signature

    profile.raw_ipfs_hash = web3.utils.sha3(stringify(profile))
    const data = await origin.contractService.getSignProfileData(profile)
    const sig = origin.contractService.breakdownSig(_profile.signature)
    const publicKey = ethUtil.ecrecover(TypedDataUtils.sign(data), sig.v, sig.r, sig.s)
    return web3.utils.toChecksumAddress(ethUtil.bufferToHex(ethUtil.pubToAddress(publicKey))) == profile.address
  }


  async recoverFinalize(listingID, offerID, ipfsBytes, payout, verifyFee, sig) {
     const data = await origin.contractService.getSignFinalizeData(
          listingID,
          offerID,
          ipfsBytes,
          payout,
          verifyFee
        )
    if (typeof sig === 'string') {
      sig = origin.contractService.breakdownSig(sig)
    }
    const publicKey = ethUtil.ecrecover( TypedDataUtils.sign(data), sig.v, sig.r, sig.s)
    return web3.utils.toChecksumAddress(ethUtil.bufferToHex(ethUtil.pubToAddress(publicKey)))
  }

  async signFinalize(listingID, offerID, ipfsBytes, payout, verifyFee) {
    const data = await origin.contractService.getSignFinalizeData(
      listingID,
      offerID,
      ipfsBytes,
      payout,
      verifyFee
    )
    const sig = ethUtil.ecsign(
      TypedDataUtils.sign(data),
      ethUtil.toBuffer(HOT_WALLET_PK)
    )
    sig.r = ethUtil.bufferToHex(sig.r)
    sig.s = ethUtil.bufferToHex(sig.s)
    return sig
  }

  async verifyOffer(offerId, params) {
    //fetch("https://api.github.com/repos/OriginProtocol/origin/issues/1407").then(r => r.json()).then(j => console.log(j.state)
    const offer = await origin.marketplace.getOffer(offerId)
    console.log('offerId:', offerId)
    const {
      adapter,
      listingIndex,
      offerIndex
    } = origin.marketplace.resolver.parseOfferId(offerId)
    const offerID = offerIndex
    const listingID = listingIndex
    const verifyTerms = offer.verifyTerms
    const acceptTerms = await origin.ipfsService.loadObjFromFile(
      origin.contractService.getIpfsHashFromBytes32(offer.acceptIpfsHash)
    )

    const verifyURL = verifyTerms.verifyURL
    const checkArg = verifyTerms.checkArg
    const matchValue = verifyTerms.matchValue

    console.log(
      'verifyTerms:',
      verifyTerms,
      ' acceptTerms:',
      acceptTerms,
      ' offerID',
      offerID,
      ' listingID',
      listingID
    )

    if (offer.verifier != this.account.address) {
      console.log(
        'Verifier mismatch:',
        offer.verifier,
        ' this.account:',
        this.account.address
      )
    }

    if (verifyURL && checkArg && matchValue) {
      const response = await fetch(verifyURL).then(r => r.json())

      if (response[checkArg] == matchValue) {
        const ipfsHash = await origin.ipfsService.saveObjAsFile({
          verifyURL,
          checkArg,
          matchValue,
          verifyRequester: params
        })
        const ipfsBytes = origin.contractService.getBytes32FromIpfsHash(
          ipfsHash
        )

        //grab the offer directly from the chain
        const rawOffer = await adapter.call('offers', [listingID, offerIndex])

        const payout = web3.utils
          .toBN(rawOffer.value)
          .sub(web3.utils.toBN(rawOffer.refund))
          .toString()
        const verifyFee = '100'
        const sig = await this.signFinalize(
          listingID,
          offerID,
          ipfsBytes,
          payout,
          verifyFee
        )
        const signature = ethUtil.bufferToHex(concatSig(sig.v, sig.r, sig.s))
        console.log(
          'Signing:',
          data,
          ' signature',
          signature,
          ' payout:',
          payout,
          ' verifyFee:',
          verifyFee
        )
        console.log('raw Offer:', rawOffer)
        return { signature, ipfsBytes, payout, verifyFee }
      }
    }
  }
}
export default Hot
