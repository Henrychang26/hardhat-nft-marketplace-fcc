const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", function () {
          let nftMarketplace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              //player = (await getNamedAccounts()).player
              const accounts = await ethers.getSigners()
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")
              await basicNft.mintNft() // calling the mint function
              await basicNft.approve(nftMarketplace.address, TOKEN_ID) //only the dployer can approve and send it to marketplace
          })

          it("lists and can be bought", async () => {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //listing the NFT with params
              const playerConnectedNftMarketplace = nftMarketplace.connect(player) //connecting the player
              await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                  value: PRICE,
              }) //player buys the item
              const newOwner = await basicNft.ownerOf(TOKEN_ID) //checking to see if the player is now the owner of NFT
              const deployerProceeds = await nftMarketplace.getProceeds(deployer) //to check if the deployer is getting paid
              assert(newOwner.toString() == player.address) //new owner is the player/buyer
              assert(deployerProceeds.toString() == PRICE.toString()) //deployer should have been paid the PRICE
          })
      })
