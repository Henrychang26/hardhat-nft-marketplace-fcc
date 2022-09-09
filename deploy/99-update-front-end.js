const { ethers, network } = require("hardhat")
const fs = require("fs")
require("dotenv").config()

const { frontEndContractsFile } = require("../helper-hardhat-config")

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("updating front end...")
        await updateContractAddresses()
    }
}
async function updateContractAddresses() {
    const nftMarketplace = await ethers.getContract("NftMarketplace")
    const chainId = network.config.chainId.toString()
    const contractAddreses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
    if (chainId in contractAddreses) {
        if (!contractAddreses[chainId]["NftMarketplace"].includes(nftMarketplace.address)) {
            contractAddreses[chainId]["NftMarketplace"].push(nftMarketplace.address)
        }
    } else {
        contractAddreses[chainId] = { NftMarketplace: [nftMarketplace.address] }
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddreses))
}

module.exports.tags = ["all", "frontend"]
