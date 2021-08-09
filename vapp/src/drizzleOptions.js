import Exchange from './contracts/Exchange.json'
import OvernightToken from './contracts/OvernightToken.json'
import USDCtest from './contracts/USDCtest.json'
import DAItest from './contracts/DAItest.json'




const options = {
    web3: {
        block: false,
        fallback: {
            type: 'ws',
            url: 'ws://127.0.0.1:8545'
        }
    },
    contracts:
        [
            Exchange,
            OvernightToken,
            USDCtest,
            DAItest
        ],
    events: {
    },
    polls: {
        accounts: 5000
    }
}

export default options
