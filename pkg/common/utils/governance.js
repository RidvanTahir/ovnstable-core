const {fromE18, toE18} = require("./decimals");
const {expect} = require("chai");
const {getContract, initWallet, getPrice, impersonateAccount} = require("./script-utils");
const hre = require('hardhat');
const {execTimelock, showM2M} = require("@overnight-contracts/common/utils/script-utils");

const ethers= hre.ethers;
const proposalStates = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];


async function createProposal(addresses, values, abis){

    let governor = await getContract('OvnGovernor');

    console.log('Creating a proposal...')
    const proposeTx = await governor.proposeExec(
        addresses,
        values,
        abis,
        ethers.utils.id(new Date().toString()),
        await getPrice()
    );
    let tx = await proposeTx.wait();
    const proposalId = tx.events.find((e) => e.event == 'ProposalCreated').args.proposalId;
    console.log('Proposal id ' + proposalId)

    return proposalId;
}

async function testProposal(addresses, values, abis){

    await execTimelock(async (timelock)=>{

        await showM2M();

        for (let i = 0; i < addresses.length; i++) {

            let address = addresses[i];
            let abi = abis[i];

            let tx = {
                from: timelock.address,
                to: address,
                value: 0,
                data: abi,
                gasLimit: 15000000
            }

            console.log(`Transaction: index: [${i}] address: [${address}]`)
            await timelock.sendTransaction(tx)

        }

        await showM2M();
    })
}

async function execProposal(id) {

    let wallet = await initWallet(ethers)
    let governator = await getContract('OvnGovernor' );
    let ovn = await getContract('OvnToken');

    let ovnOwner = await impersonateAccount('0xe497285e466227f4e8648209e34b465daa1f90a0');
    await ovn.connect(ovnOwner).transfer(wallet.address, await ovn.balanceOf(ovnOwner.address));
    await ovn.connect(wallet).delegate(wallet.address);

    let quorum = fromE18((await governator.quorum(await ethers.provider.getBlockNumber() - 1)).toString());
    console.log('Quorum: ' + quorum);
    console.log('OVN balance user: ' + fromE18((await ovn.balanceOf(wallet.address)).toString()));

    const proposalId = id;

    let votes = ethers.utils.parseUnits("100000100", 9);

    let state = proposalStates[await governator.state(proposalId)];
    if (state === "Executed") {
        return;
    }
    if (state === "Queued"){
        await governator.executeExec(proposalId);
        return;
    }

    console.log('State status: ' + state)
    await ethers.provider.send('evm_mine'); // wait 1 block before opening voting

    console.log('Votes: ' + votes);

    let item = await governator.connect(wallet).proposals(proposalId);
    console.log('Votes for: ' + item.forVotes / 10 ** 18);

    await governator.connect(wallet).castVote(proposalId, 1);

    item = await governator.connect(wallet).proposals(proposalId);
    console.log('Votes for: ' + item.forVotes / 10 ** 18);

    let total = fromE18((await ovn.getVotes(wallet.address)).toString());
    console.log('Delegated ' + total);

    console.log('State: ' + proposalStates[await governator.state(proposalId)]);

    let waitBlock = 150;
    for (let i = 0; i < waitBlock; i++) {
        await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
    }

    state = proposalStates[await governator.state(proposalId)];
    expect('Succeeded').to.eq(state);
    await governator.connect(wallet).queueExec(proposalId);

    const sevenDays = 6 * 60 * 60 * 1000;
    await ethers.provider.send("evm_increaseTime", [sevenDays])
    await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
    await governator.connect(wallet).executeExec(proposalId);


    state = proposalStates[await governator.state(proposalId)];
    console.log('State status: ' + state)
    expect(state).to.eq('Executed');
}


module.exports = {
    execProposal: execProposal,
    createProposal: createProposal,
    testProposal: testProposal,
}
