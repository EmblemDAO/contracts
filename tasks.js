const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { gql, request, GraphQLClient } = require("graphql-request");

const EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME = "EmblemSubgraphController";
const EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI = "0x24C60517E74F5A14a52A5AfcD7566A2B4A64090b";
const EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_HH = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const MUMBAI_FX_CHILD = "0xCf73231F28B7331BBe3124B907840A94851f9f11";
const POLYGON_FX_CHILD = "0x8397259c983751DAf40400790063935a11afa28a";
const GOERLI_CHECKPOINT_MANAGER = "0x2890bA17EfE978480615e330ecB65333b880928e";
const GOERLI_FX_ROOT = "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA";
const MAINNET_CHECKPOINT_MANAGER = "0x86e4dc95c7fbdbf52e33d563bbdb00823894c287";
const MAINNET_FX_ROOT = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";

const EMBLEM_LIBRARY_CONTRACT_NAME = "EmblemLibrary";
const EMBLEM_LIBRARY_ADDRESS_MUMBAI = "0x9fADDec46Bc5E2ba47BcE182757277516B253007";

const EMBLEM_REGISTRY_CONTRACT_NAME = "EmblemRegistry";
const EMBLEM_REGISTRY_ADDRESS_HH = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const EMBLEM_REGISTRY_ADDRESS_MUMBAI = "0x5EFe90C13f2955576e21AEb8Ce2A60AB07117032";

const EMBLEM_GQL_ENDPOINT = "https://api.studio.thegraph.com/query/2486/test/2.2.3";
const EMBLEM_EARNED_BADGE_COUNT_QUERY = gql`
    query getMerkleLeaves($startingIndex: Int, $treeSize: Int) {
        earnedBadgeCounts(first: $treeSize, skip: $startingIndex, orderBy: globalBadgeNumber) {
            earnedBadge {
                badgeWinner {
                    id
                }
                definition {
                    badgeDefinitionNumber
                }
            }
        }
    }`


subtask("deploySubgraphControllerWithFx", "Deploys SubgraphController contract")
.addParam("checkpointManager", "address of checkpoint manager for polygon bridge communication")
.addParam("fxRoot", "address of fxRoot used for polygon bridge communication")
.setAction(async (taskArgs) => {
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    const subgraphControllerContract = await subgraphControllerContractFactory.deploy(taskArgs.checkpointManager, taskArgs.fxRoot);
    await subgraphControllerContract.deployed();
    console.log("SubgraphController contract deployed to: " + subgraphControllerContract.address);
});

subtask("deployRegistryWithFx", "Deploys Registry contract intended for layer 2")
.addParam("fxChild", "address of fxChild for polygon bridge communication")
.setAction(async (taskArgs) => {
    const emblemLibraryContractFactory = await ethers.getContractFactory(EMBLEM_LIBRARY_CONTRACT_NAME);
    const emblemLibraryContract = await emblemLibraryContractFactory.deploy();
    await emblemLibraryContract.deployed();

    console.log("Library contract deployed to: " + emblemLibraryContract.address);

    const emblemRegistryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: emblemLibraryContract.address
            }
        }
    );
    const emblemRegistryContract = await emblemRegistryContractFactory.deploy(taskArgs.fxChild);
    await emblemRegistryContract.deployed();

    console.log("Registry contract deployed to: " + emblemRegistryContract.address);
});

subtask("setChildTunnelMapping", "Points SubgraphController at Registry contract for bridged communication")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.addParam("registryContractAddress", "address of Registry contract intended for layer 2")
.setAction(async (taskArgs) => {
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
    console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);

    await subgraphControllerContract.setFxChildTunnel(taskArgs.registryContractAddress);
    const childTunnel = await subgraphControllerContract.fxChildTunnel();
    console.log("SubgraphController child set to " + childTunnel);
});


subtask("setRootTunnelMapping", "Points Registry contract at SubgraphController")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.addParam("registryContractAddress", "address of Registry contract intended for layer 2")
.addParam("libraryAddress", "address of library used by Registry contract")
.setAction(async (taskArgs) => {

    const emblemRegistryContractFactory = await ethers.getContractFactory(
        EMBLEM_REGISTRY_CONTRACT_NAME,
        {
            libraries: {
                EmblemLibrary: taskArgs.libraryAddress
            }
        }
    );

    const registryContract = await emblemRegistryContractFactory.attach(taskArgs.registryContractAddress);
    console.log("Attached to Registry contract at " + registryContract.address);

    await registryContract.setFxRootTunnel(taskArgs.subgraphControllerAddress);
    const rootTunnel = await registryContract.fxRootTunnel();
    console.log("Registry fxRoot set to " + rootTunnel);
});




task("deploySubgraphController", "Deploys SubgraphController contract with Goerli-Mumbai polygon bridge initialization")
.setAction(async() => {
    if (hre.network.name == "goerli") {
        await hre.run("deploySubgraphControllerWithFx",
        {
            checkpointManager: GOERLI_CHECKPOINT_MANAGER,
            fxRoot: GOERLI_FX_ROOT
        });
    } else if (hre.network.name == "mainnet") {
        await hre.run("deploySubgraphControllerWithFx",
        {
            checkpointManager: MAINNET_CHECKPOINT_MANAGER,
            fxRoot: MAINNET_FX_ROOT
        });
    } else {
        console.log("no checkpoint manager or fx root on current network: " + hre.network.name);
    }
});

task("deployRegistry", "Deploys SubgraphController contract with Mumbai->Goerli polygon bridge initialization")
.setAction(async() => {
    if (hre.network.name == "mumbai") {
        await hre.run("deployRegistryWithFx",
        {
            fxChild: MUMBAI_FX_CHILD
        });
    } else if (hre.network.name == "matic") {
        await hre.run("deployRegistryWithFx",
        {
            fxChild: POLYGON_FX_CHILD
        });
    } else {
        console.log("no fx child on current network: " + hre.network.name);
    }
});


task("setTunnelMapping", "Points contracts from different networks at eachother")
.setAction(async () => {
    if (hre.network.name == "mumbai") {
        await hre.run("setRootTunnelMapping",
        {
            subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI,
            registryContractAddress: EMBLEM_REGISTRY_ADDRESS_MUMBAI,
            libraryAddress: EMBLEM_LIBRARY_ADDRESS_MUMBAI
        });
    }
    else if (hre.network.name == "goerli") {
        await hre.run("setChildTunnelMapping", 
        { 
          subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI,
          registryContractAddress: EMBLEM_REGISTRY_ADDRESS_MUMBAI
        });
    }
    else {
        console.log("task doesn't support network: " + hre.network.name);
    }
});

subtask("postMerkleRoot", "posts a bytes32 value to SubgraphController Contract")
.addParam("merkleRoot", "32 byte hash")
.addParam("startingIndex", "index where the tree starts")
.addParam("treeSize", "index where the tree ends")
.setAction(async (taskArgs) => {
    if (hre.network.name == "goerli") {
        const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
        const subgraphControllerContract = await subgraphControllerContractFactory.attach(EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI);
        await subgraphControllerContract.postMerkleRoot(taskArgs.merkleRoot, taskArgs.startingIndex, taskArgs.treeSize);
    } else {
        console.log("no SubgraphController found on network: " + hre.network.name);
    }
});


task("postMerkleRootFromSubgraph", "queries an EmblemDAO subgraph for a merkle tree of BadgeAwards")
.addParam("index", "index where the tree starts")
.addParam("size", "size of tree")
.setAction(async (taskArgs) => {
    const client = new GraphQLClient(EMBLEM_GQL_ENDPOINT);
    const variables = {
        startingIndex: parseInt(taskArgs.index),
        treeSize: parseInt(taskArgs.size)
    };
    const leaves = (await client.request(EMBLEM_EARNED_BADGE_COUNT_QUERY, variables)).earnedBadgeCounts;
    const hashedLeaves = leaves.map(earnedBadgeCount => hashBadge(earnedBadgeCount.earnedBadge));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: false });
    console.log(tree.getHexRoot());
    await hre.run("postMerkleRoot", 
    { 
        merkleRoot: tree.getHexRoot(),
        startingIndex: taskArgs.index,
        treeSize: taskArgs.size
    });
});

function hashBadge(earnedBadge) {
    let hashedBadge = ethers.utils.solidityKeccak256(
      ['address', 'int8'],
      [earnedBadge.badgeWinner.id, earnedBadge.definition.badgeDefinitionNumber]
    );
    return hashedBadge;
}

task("unfurlMerkleRoot", "mints all badges from a tree")
.addParam("root", "32 byte hash")
.addParam("index", "index where the tree starts")
.addParam("size", "size of tree")
.setAction(async (taskArgs) => {
    const client = new GraphQLClient(EMBLEM_GQL_ENDPOINT);
    const variables = {
        startingIndex: parseInt(taskArgs.index),
        treeSize: parseInt(taskArgs.size)
    };
    const leaves = (await client.request(EMBLEM_EARNED_BADGE_COUNT_QUERY, variables)).earnedBadgeCounts;
    const hashedLeaves = leaves.map(earnedBadgeCount => hashBadge(earnedBadgeCount.earnedBadge));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: false });

    if (hre.network.name == "mumbai") {
        const emblemRegistryContractFactory = await ethers.getContractFactory(
            EMBLEM_REGISTRY_CONTRACT_NAME,
            {
                libraries: {
                    EmblemLibrary: EMBLEM_LIBRARY_ADDRESS_MUMBAI
                }
            }
        );

        const registryContract = await emblemRegistryContractFactory.attach(EMBLEM_REGISTRY_ADDRESS_MUMBAI);
        console.log("Attached to Registry contract at " + registryContract.address);

        // for (let i = parseInt(taskArgs.index); i < parseInt(taskArgs.index) + parseInt(taskArgs.size); i++) {
        for (let i = 2; i < parseInt(taskArgs.index) + parseInt(taskArgs.size); i++) {
            const proof = tree.getHexProof(hashedLeaves[i]);
            const positions = tree.getProof(hashedLeaves[i]).map(x => x.position === 'right' ? 1 : 0);

            const solidityBadge = {
                winner: leaves[i].earnedBadge.badgeWinner.id,
                badgeDefinitionNumber: leaves[i].earnedBadge.definition.badgeDefinitionNumber
            };
            // console.log(i + ": " + solidityBadge.winner + "   " + solidityBadge.badgeDefinitionNumber);
            // console.log(proof.toString());

            await registryContract.mint(solidityBadge, proof, positions, tree.getHexRoot());
        }
    }
    else {
        console.log("minting not supported on " + hre.network.name + " network.");
    }
});


///////////// Debug Tasks /////////////

task("printSubgraphController", "prints SubgraphController contract properties")
.setAction(async () => {
    let subgraphControllerAddress = "";
    if (hre.network.name == "goerli") {
        subgraphControllerAddress = EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI;
    } else if (hre.network.name == "hardhat") {
        subgraphControllerAddress = EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_HH;
    } else {
        console.log("no SubgraphController found on this network");
    }

    await hre.run("printSubgraphControllerProperties",
    {
        subgraphControllerAddress: EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI
    });
});

subtask("printSubgraphControllerProperties", "prints properties of SubgraphController")
.addParam("subgraphControllerAddress", "address of Subgraph Controller contract")
.setAction(async (taskArgs) => {
    const subgraphControllerContractFactory = await ethers.getContractFactory(EMBLEM_SUBGRAPH_CONTROLLER_CONTRACT_NAME);
    const subgraphControllerContract = await subgraphControllerContractFactory.attach(taskArgs.subgraphControllerAddress);
    console.log("Attached to SubgraphControllerContract at " + subgraphControllerContract.address);
    const fxRoot = await subgraphControllerContract.fxRoot();
    const checkpointManager = await subgraphControllerContract.checkpointManager();
    const fxChild = await subgraphControllerContract.fxChildTunnel();
    console.log("---SubgraphController---" + subgraphControllerContract.address + 
    "\n-fxRoot: " + fxRoot + "\n-checkpointManager: " + checkpointManager + "\n-fxChild: " + fxChild);
});

task("printRegistry", "prints Registry contract properties")
.setAction(async () => {
    let registryAddress = "";
    let libraryAddress = "";
    if (hre.network.name == "mumbai") {
        registryAddress = EMBLEM_REGISTRY_ADDRESS_MUMBAI;
        libraryAddress = EMBLEM_LIBRARY_ADDRESS_MUMBAI;
    }
    else {
        console.log("no Registry contract found on this network");
    }

    await hre.run("printRegistryProperties",
    {
        registryAddress: registryAddress,
        libraryAddress: libraryAddress
    })
});

subtask("printRegistryProperties", "prints properties of Registry")
.addParam("registryAddress", "address of Registry contract")
.addParam("libraryAddress", "address of library used by Registry contract")
.setAction(async (taskArgs) => {
  const emblemRegistryContractFactory = await ethers.getContractFactory(
    EMBLEM_REGISTRY_CONTRACT_NAME,
    {
      libraries: {
        EmblemLibrary: taskArgs.libraryAddress
      }
    }
  )

  const registryContract = await emblemRegistryContractFactory.attach(taskArgs.registryAddress);
  console.log("Attached to Registry contract at " + registryContract.address);

  const fxChild = await registryContract.fxChild();
  const fxRootTunnel = await registryContract.fxRootTunnel();
  const latestStateId = await registryContract.latestStateId();
  console.log("---Registry---" + registryContract.address + "\n-fxChild: " + 
  fxChild + "\n-fxRootTunnel: " + fxRootTunnel + 
  "\n-latestStateId: " + latestStateId);
});




///////////// Block Explorer Verification Tasks /////////////

task("verifySubgraphController", "verifies SubgraphController contract on etherscan")
.setAction(async () => {
    let subgraphControllerAddress = "";
    let checkpointManagerAddress = "";
    let fxRootAddress = "";
    if (hre.network.name == "goerli") {
        subgraphControllerAddress = EMBLEM_SUBGRAPH_CONTROLLER_ADDRESS_GOERLI;
        checkpointManagerAddress = GOERLI_CHECKPOINT_MANAGER;
        fxRootAddress = GOERLI_FX_ROOT;
    } 
    else {
        console.log("no SubgraphController found on this network");
    }
    await hre.run("verify:verify", {
        address: subgraphControllerAddress,
        constructorArguments: [
            checkpointManagerAddress,
            fxRootAddress
        ]
    });
});

task("verifyRegistry", "verifies Registry contract on polygonscan")
.setAction(async () => {
    let registryAddress = "";
    let fxChildAddress = "";
    if (hre.network.name == "mumbai") {
        registryAddress = EMBLEM_REGISTRY_ADDRESS_MUMBAI;
        fxChildAddress = MUMBAI_FX_CHILD;
    } else {
        console.log("no Registry found on this network");
    }

    await hre.run("verify:verify", {
        address: registryAddress,
        constructorArguments: [
            fxChildAddress
        ]
    });
});
