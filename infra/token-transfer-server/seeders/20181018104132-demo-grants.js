'use strict'

// TODO: create seeder that reads in a CSV file
module.exports = {
  up: (queryInterface) => {
    queryInterface.bulkInsert('t3_user', [
      {
        id: 1,
        email: 'foo@originprotocol.com',
        created_at: new Date(),
        updated_at: new Date()
      }], {})
    return queryInterface.bulkInsert('Grant', [
      {
        email: 'foo@originprotocol.com',
        granted_at: '2010-01-31 00:00:00',
        amount: 120000,
        total_months: 48,
        cliff_months: 12,
        vested: 120000,
        transferred: 100000,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'foo@originprotocol.com',
        granted_at: '2017-01-31 00:00:00',
        amount: 480,
        total_months: 48,
        cliff_months: 12,
        vested: 0,
        transferred: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'foo@originprotocol.com',
        granted_at: '2017-08-01 00:00:00',
        amount: 112,
        total_months: 48,
        cliff_months: 12,
        vested: 0,
        transferred: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'foo@originprotocol.com',
        granted_at: '2018-08-01 00:00:00',
        amount: 120,
        total_months: 48,
        cliff_months: 12,
        vested: 0,
        transferred: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {})
  },

  down: (queryInterface) => {
    queryInterface.bulkDelete('t3_user', null, {})
    return queryInterface.bulkDelete('Grant', null, {})
  }
}
