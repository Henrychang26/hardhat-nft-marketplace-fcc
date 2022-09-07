const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", function () {
          let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              accounts = await ethers.getSigners() //can also be getNamedAccounts
              deployer = accounts[0]
              //player = (await getNamedAccounts()).player
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = await basicNftContract.connect(deployer)
              await basicNft.mintNft() // calling the mint function
              await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID) //only the dployer can approve and send it to marketplace
          })

          //   it("lists and can be bought", async () => {
          //       await nftMarketplaceContract.listItem(basicNft.address, TOKEN_ID, PRICE) //listing the NFT with params
          //       const playerConnectedNftMarketplace = nftMarketplaceContract.connect(user) //connecting the player
          //       await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
          //           value: PRICE,
          //       }) //player buys the item
          //       const newOwner = await basicNft.ownerOf(TOKEN_ID) //checking to see if the player is now the owner of NFT
          //       const deployerProceeds = await nftMarketplaceContract.getProceeds(deployer) //to check if the deployer is getting paid
          //       assert(newOwner.toString() == user.address) //new owner is the player/buyer
          //       assert(deployerProceeds.toString() == PRICE.toString()) //deployer should have been paid the PRICE
          //   })

          describe("listItem", () => {
              it("emits an event after listing an item", async () => {
                  //call the contract function with params
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })
              it("exclusively items that haven't been listed", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})` //returns error and address and token ID
                  //   await expect(
                  //       nftMarketplace
                  //           .listItem(basicNft.address, TOKEN_ID, PRICE)
                  //           .to.be.revertWith("AlreadyListed")
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("exclusively allows owners to list", async () => {
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")
              })
              it("needs approvals to list item", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotApprovedForMarketplace")
              })
              it("updates listing with seller and price", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //lists the NFT
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID) //calling getListing getter function
                  assert(listing.price.toString() == PRICE.toString()) //Price should match
                  assert(listing.seller.toString() == deployer.address) //seller is also the deployer of NFT
              })
          })
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                  //make sure to have space in between params
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //list item first
                  nftMarketplace = nftMarketplaceContract.connect(user) //connect user outside of owner
                  await basicNft.approve(user.address, TOKEN_ID) //when user tries to approve
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID) //cancelListing function should revert here
                  ).to.be.revertedWith("NotOwner")
              })
              it("emits even and removes listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //list item
                  nftMarketplace.cancelListing(basicNft.address, TOKEN_ID) //cancels listing
                  expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      //should emit this event
                      "ItemCanceled"
                  )
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID) //must have await here
                  assert(listing.price.toString() == "0") //list price should be 0 since there is no more listing
              })
          })
          describe("buyItem", function () {
              it("reverts if the item isn't listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID) //make sure to check params in original contract
                  ).to.be.revertedWith("NotListed")
              })
              it("reverts when the price isn't met", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //List item first
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet")
              })
              it("transfer the nft to the buyer and updates internal proceeds record", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //List item first
                  nftMarketplace = nftMarketplaceContract.connect(user) //connect the user
                  expect(
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE }) //Dont forget to pass in value
                  ).to.emit("ItemBought")
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert(newOwner.toString() == user.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })
          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotListed")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(user) //connecting user who is not owner
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")
              })
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed")
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })
          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceeds withdrawls", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })
              it("withdraw proceeds", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //list item
                  nftMarketplace = nftMarketplaceContract.connect(user) //connect user outside of owner
                  await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE }) //User buys the NFT
                  nftMarketplace = nftMarketplaceContract.connect(deployer)

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address) // deployer's balacnce before proceeds
                  const deployerBalanceBefore = await deployer.getBalance() //getting balance from before
                  const txResponse = await nftMarketplace.withdrawProceeds() //txResponse from withdrawProceeds function
                  const transactionReceipt = await txResponse.wait(1) //wait for 1 block confirmation
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice) //gasUsed multiply by effectieGasPrice
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
