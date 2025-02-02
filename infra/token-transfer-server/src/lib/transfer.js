const Token = require('@origin/token/src/token')

const {
  GRANT_TRANSFER_DONE,
  GRANT_TRANSFER_FAILED,
  GRANT_TRANSFER_REQUEST
} = require('../constants/events')
const { Event, Grant, Transfer, User, sequelize } = require('../models')
const enums = require('../enums')
const logger = require('../logger')

// Number of block confirmations required for a transfer to be consider completed.
const NumBlockConfirmation = 8

// Wait up to 20 min for a transaction to get confirmed
const ConfirmationTimeoutSec = 20 * 60 * 60

/**
 * Helper method to check the validity of a transfer request.
 * Throws an exception in case the request sis invalid.
 * @param userId
 * @param grantId
 * @param amount
 * @param {Transfer} transfer: Optional. The pending transfer to check for.
 * @returns {Promise<void>}
 * @private
 */
async function _checkTransferRequest(userId, grantId, amount, transfer = null) {
  // Check the user exists.
  const user = await User.findOne({
    where: { id: userId }
  })
  if (!user) {
    throw new Error(`No user found with id ${userId}`)
  }

  // Load the grant and check there are enough tokens available to fullfill the transfer request.
  const grant = await Grant.findOne({
    where: {
      id: grantId
      // FIXME(franck): add this condition after changing grant table to have userId
      //userId
    }
  })
  if (!grant) {
    throw new Error(
      `Could not find specified grant id ${grantId} for user ${user.email}`
    )
  }

  // TODO(franck/tom): Replace with a call to the logic for calculating tokens available.
  //   Note: If transfer arg is not null, make sure to not double count that amount.
  const placeholderAvailable = () => {
    return grant.amount
  }
  const available = placeholderAvailable(userId, grantId, transfer)
  if (amount > available) {
    throw new RangeError(
      `Amount of ${amount} OGN exceeds the ${available} available for grant ${grantId}`
    )
  }
}

/**
 * Enqueues a request to transfer tokens.
 * @param userId
 * @param grantId
 * @param address
 * @param amount
 * @returns {Promise<integer>} Id of the transfer request.
 */
async function enqueueTransfer(userId, grantId, address, amount, ip) {
  await _checkTransferRequest(userId, grantId, amount)

  // Enqueue the request by inserting a row in the transfer table.
  // It will get picked up asynchronously by the offline job that processes transfers.
  // Record new state in the database.
  let transfer
  const txn = await sequelize.transaction()
  try {
    transfer = await Transfer.create({
      grantId,
      userId,
      status: enums.TransferStatuses.Enqueued,
      toAddress: address.toLowerCase(),
      amount,
      currency: 'OGN' // For now we only support OGN.
    })
    await Event.create({
      userId,
      grantId,
      action: GRANT_TRANSFER_REQUEST,
      data: JSON.stringify({
        transferId: transfer.id,
        amount: amount,
        to: address
      }),
      ip
    })
    await txn.commit()
  } catch (e) {
    await txn.rollback()
    logger.error(`Failed to enqueue transfer for address ${address}: ${e}`)
    throw e
  }
  logger.info(
    `Enqueued transfer. id: {transfer.id} address: ${address} amount: ${amount}`
  )
  return transfer.id
}

/**
 * Sends a blockchain transaction to transfer tokens and waits for the transaction to get confirmed.
 * @param {Transfer} transfer: DB model Transfer object
 * @param {{tokenMock:Object, networkId:number }} opts: options
 * @returns {Promise<{txHash: string, txStatus: string}>}
 */
async function executeTransfer(transfer, opts) {
  const { networkId, tokenMock } = opts

  await _checkTransferRequest(
    transfer.userId,
    transfer.grantId,
    transfer.amount,
    transfer
  )

  // Setup token library. tokenMock is used for testing.
  const token = tokenMock || new Token(networkId)

  // Send transaction to transfer the tokens and record txHash in the DB.
  const naturalAmount = token.toNaturalUnit(transfer.amount)
  const supplier = await token.defaultAccount()
  const txHash = await token.credit(transfer.toAddress, naturalAmount)
  await transfer.update({
    status: enums.TransferStatuses.WaitingConfirmation,
    fromAddress: supplier.toLowerCase(),
    txHash
  })

  // Wait for the transaction to get confirmed.
  const { status } = await token.waitForTxConfirmation(txHash, {
    numBlocks: NumBlockConfirmation,
    timeoutSec: ConfirmationTimeoutSec
  })
  let transferStatus, eventAction, failureReason
  switch (status) {
    case 'confirmed':
      transferStatus = enums.TransferStatuses.Success
      eventAction = GRANT_TRANSFER_DONE
      break
    case 'failed':
      transferStatus = enums.TransferStatuses.Failed
      eventAction = GRANT_TRANSFER_FAILED
      failureReason = 'Tx failed'
      break
    case 'timeout':
      transferStatus = enums.TransferStatuses.Failed
      eventAction = GRANT_TRANSFER_FAILED
      failureReason = 'Confirmation timeout'
      break
    default:
      throw new Error(`Unexpected status ${status} for txHash ${txHash}`)
  }
  logger.info(`Received status ${status} for txHash ${txHash}`)

  // Update the status in the transfer table.
  // Note: only create an event in case the transaction is successful. The event
  // table is used as an activity log presented to the user and we don't want
  // them to get alarmed if a transaction happened to fail. Our team will investigate,
  // fix the issue and resubmit the transaction if necessary.
  const txn = await sequelize.transaction()
  try {
    await transfer.update({ status: transferStatus })
    const event = {
      userId: transfer.userId,
      grantId: transfer.grantId,
      action: eventAction,
      data: JSON.stringify({
        transferId: transfer.id,
        amount: transfer.amount,
        from: supplier,
        to: transfer.toAddress,
        txHash
      })
    }
    if (failureReason) {
      event.failureReason = failureReason
    }
    await Event.create(event)
    await txn.commit()
  } catch (e) {
    await txn.rollback()
    logger.error(
      `Failed writing confirmation data for transfer ${transfer.id}: ${e}`
    )
    throw e
  }

  return { txHash, txStatus: status }
}

module.exports = { enqueueTransfer, executeTransfer }
