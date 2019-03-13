export default {
  'fiat-USD': {
    id: 'fiat-USD',
    name: 'US Dollar',
    code: 'USD',
    priceInUSD: 1,
    countryCodes: ['US']
  },
  'fiat-GBP': {
    id: 'fiat-GBP',
    name: 'British Pound',
    code: 'GBP',
    priceInUSD: 0.77,
    countryCodes: ['GB']
  },
  'fiat-EUR': {
    id: 'fiat-EUR',
    name: 'Euro',
    code: 'EUR',
    priceInUSD: 1.13,
    countryCodes: ['FR']
  },
  'token-ETH': {
    id: 'token-ETH',
    address: '0x0000000000000000000000000000000000000000',
    code: 'ETH',
    name: 'Ether',
    decimals: 18
  },
  'token-DAI': {
    id: 'token-DAI',
    // address: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
    name: 'DAI Stablecoin',
    code: 'DAI',
    priceInUSD: 1,
    decimals: 18
  },
  'token-USDC': {
    id: 'token-USDC',
    // address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    name: 'USDC Stablecoin',
    code: 'USDC',
    priceInUSD: 1,
    decimals: 6
  },
  'token-GUSD': {
    id: 'token-GUSD',
    // address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    name: 'Gemini Dollar',
    code: 'GUSD',
    priceInUSD: 1,
    decimals: 2
  }
}