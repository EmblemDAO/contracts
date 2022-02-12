// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {BadgethLibrary} from "./BadgethLibrary.sol";

contract EmblemSubgraphController is AccessControl {
    
    event MerkleRootPosted(bytes32 indexed _root, uint32 _startingIndex, uint32 _treeSize);
    event BadgeDefinitionCreated(uint32 indexed _definitionNumber, uint32 _metric, uint256 _threshold);
    event BadgeDefinitionFrozen(uint32 indexed _definitionNumber);

    uint32 public nextBadgeDefinitionNumber;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        nextBadgeDefinitionNumber = 0;
    }

    function postMerkleRoot(
        bytes32 merkleRoot,
        uint32 startingIndex,
        uint32 treeSize
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemSubgraphController admin");
        emit MerkleRootPosted(merkleRoot, startingIndex, treeSize);

        // todo: relay merkle root to Polygon contract
    }

    function createBadgeDefinition(
        uint32 metric,
        uint256 threshold
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemSubgraphController admin");
        emit BadgeDefinitionCreated(nextBadgeDefinitionNumber, metric, threshold);
        nextBadgeDefinitionNumber += 1;
    }

    function freezeBadgeDefinition(
        uint32 definitionNumber
    ) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not EmblemSubgraphController admin");
        emit BadgeDefinitionFrozen(definitionNumber);
    }
}