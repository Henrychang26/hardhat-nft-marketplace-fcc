const { ethers, network } = require("hardhat")
const fs = require("fs")
require("dotenv").config()

const { frontEndContractsFile, frontEndAbiLocation } = require("../helper-hardhat-config")

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("updating front end...")
        await updateContractAddresses()
        await updateAbi()
    }
}

async function updateAbi() {
    const nftMarketplace = await ethers.getContract("NftMarketplace")
    fs.writeFileSync(
        `${frontEndAbiLocation}NftMarketplace.json`,
        nftMarketplace.interface.format(ethers.utils.FormatTypes.json)
    )

    const basicNft = await ethers.getContract("BasicNft")
    fs.writeFileSync(
        `${frontEndAbiLocation}BasicNft.json`,
        basicNft.interface.format(ethers.utils.FormatTypes.json)
    )
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
