require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.0",
  networks: {
    hardhat: {
      forking: {
        url: "https://1rpc.io/matic",
        blockNumber: 20325055,
      }
    },
  }
};