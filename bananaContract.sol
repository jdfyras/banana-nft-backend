// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MerkleNFT is ERC721, Ownable(msg.sender) {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    bytes32[] public merkleRoots;

    // Mapping to record the mint timestamp for each token.
    mapping(uint256 => uint256) public mintTimestamps;

    mapping(uint256 => bool) public revealed;

    mapping(uint256 => string) private _tokenURIs;

    uint256 public revealThreshold = 60;

    string public defaultURI;

    event MerkleSetAdded(uint256 indexed rootIndex, uint256 _quantity, address _user);
    event NFTRevealed(uint256 indexed tokenId, string tokenURI);
    event BatchTransfer(address indexed to, uint256[] tokenIds);

    /**
     * @notice Constructor sets the token name, symbol, and default unrevealed URI.
     * @param _name The name of the NFT collection.
     * @param _symbol The token symbol.
     * @param _defaultURI The default URI for unrevealed NFTs.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _defaultURI
    ) ERC721(_name, _symbol) {
        defaultURI = _defaultURI;
    }

    function mintWithMerkle(bytes32 _merkleRoot, address _user, uint256 _quantity) external onlyOwner {
        merkleRoots.push(_merkleRoot);
        uint256 rootIndex = merkleRoots.length - 1;

        for (uint256 i = 0; i < _quantity; i++) {
            _tokenIdCounter.increment();
            uint256 newTokenId = _tokenIdCounter.current();
            _mint(_user, newTokenId);
            mintTimestamps[newTokenId] = block.timestamp;
        }
        emit MerkleSetAdded(rootIndex, _quantity, _user);
    }


    function reveal(
        uint256 tokenId,
        uint256 rootIndex,
        bytes32[] calldata merkleProof,
        string calldata _uri
    ) external onlyOwner {
        require(!revealed[tokenId], "Token already revealed");
        require(block.timestamp <= mintTimestamps[tokenId] + revealThreshold, "Reveal period has expired");
        require(rootIndex < merkleRoots.length, "Invalid merkle root index");
        require(bytes(_uri).length > 0, "URI must be non-empty");

        // Compute the leaf hash from tokenId and receiver.
        bytes32 leaf = keccak256(abi.encodePacked(tokenId, _uri));
        require(MerkleProof.verify(merkleProof, merkleRoots[rootIndex], leaf), "Invalid merkle proof");

        revealed[tokenId] = true;
        _tokenURIs[tokenId] = _uri;


        emit NFTRevealed(tokenId, _uri);
    }

    /**
     * @notice Batch transfers multiple tokens from the contract to a specified address.
     * @param tokenIds An array of token IDs to transfer.
     * @param to The address to which the tokens will be transferred.
     *
     * All token IDs provided must currently be owned by the contract.
     */
    function batchTransfer(uint256[] calldata tokenIds, address to) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == address(this), "Token is not owned by contract");
            _transfer(address(this), to, tokenId);
        }
        emit BatchTransfer(to, tokenIds);
    }

    /**
     * @notice Returns the token URI.
     * @param tokenId The token ID to query.
     * @return If the token is revealed, returns its stored complete URI; otherwise returns the default URI.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId<=_tokenIdCounter.current(), "URI query for nonexistent token");
        if (revealed[tokenId]) {
            return _tokenURIs[tokenId];
        } else {
            return defaultURI;
        }
    }

    // Additional administrative functions:

    /**
     * @notice Updates the default URI for unrevealed tokens.
     * @param _defaultURI The new default URI.
     */
    function setDefaultURI(string memory _defaultURI) external onlyOwner {
        defaultURI = _defaultURI;
    }

    /**
     * @notice Updates the reveal threshold (time window) in seconds.
     * @param _revealThreshold The new reveal threshold in seconds.
     */
    function setRevealThreshold(uint256 _revealThreshold) external onlyOwner {
        revealThreshold = _revealThreshold;
    }
}
