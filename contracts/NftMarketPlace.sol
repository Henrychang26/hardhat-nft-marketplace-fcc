//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
    }
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    ); //params should match emit at the bottom!
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);

    //NFT Contract address -> NFT tokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings; //"Listing" here takes both uint256 and address as declated in struct above

    //Seller address -> amount earned
    mapping(address => uint256) private s_proceeds;

    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }
    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId); //function from ERC721
        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }
    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId]; //go into the mapping here
        if (listing.price <= 0) {
            //check the price
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    //Main Functions

    /*
     *@notice Method for listing your NFT on the marketplace
     *@param nftAddress: Address of the NFT
     *@param tokenId: The Token ID of the NFT
     *@param price: sale price of the listed NFT
     *@dev Technically, we could have the contract be the escrow for the NFTs
     *but this way people can still hold their NFTs when listed.
     */

    function listItem(
        //Need the address of owner of NFT, tokenId and price
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external notListed(nftAddress, tokenId, msg.sender) isOwner(nftAddress, tokenId, msg.sender) {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        //1. send the NFT to the contract. Transfer -> Contract "hold" the NFT. -->Gas expensive, stored on chain
        //2. Owners can still hold their NFT, and give the marketplace approval to sell the NFT for them.
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            //If the tokenId does not match
            revert NftMarketplace__NotApprovedForMarketplace(); //revert
        }
        //Array or Mapping
        //array is more complicated having to read from dynamic array
        //update s_listings mapping
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        nonReentrant
        isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }
        //we dont just send the seller money...why?
        //shift the risk
        //Instead of sending money to seller,
        //we will have them withdraw the money
        //Best practice is change the state before calling outside contract
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value; //updates the sellers total balance amount
        delete (s_listings[nftAddress][tokenId]); //deletes the listing and mapping
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId); //transfer
        //check to make sure NFT is transferred.
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete (s_listings[nftAddress][tokenId]); //deletes the mapping
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender]; //All the proceeds of Seller
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0; //make sure the balance is 0 before sending due to reetrance attacks
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    //Getter Functions

    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
// 1. `listItem`: List NFTs on the marketplace
// 2. `buyItem`: Buy the NFTs
// 3.`cancelItem`: Cancel a listing
// 4.`updateListing`: Update Price
// 5.`withdrawProceeds`: Withdraw payment for my bought NFTs
