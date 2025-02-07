import {
  ArtistInfo,
  PhotoCardInfo,
  ProposalInfo,
  Web3Type,
  MakeProposal,
  VoteKind,
} from "./../types";
import { useEffect, useState } from "react";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import injectedModule from "@web3-onboard/injected-wallets";
import Onboard, { WalletState } from "@web3-onboard/core";
import { BigNumber, ethers } from "ethers";
import AuctionHouseArtifact from "../contract/abi/FantosiAuctionHouse.json";
import ViewArtifact from "../contract/abi/FantosiView.json";
import FantosiDAOLogicArtifact from "../contract/abi/FantosiDAOLogic.json";

const AUCTION_HOUSE_ADDR = "0x65a4544F7B95278e5D8AAbC5BC383b4e61Fd93E0";
const AUCTION_VIEW_ADDR = "0x543AfCA36CE3A2cE6bAc886f1bDc169F2382Dc8f";
const FANTOSI_DAO_LOGIC_ADDR = "0x3489323335068b716398B1DEc640027903049d63";
const FANTOSI_DAO_EXCUTER_ADDR = "0x50356bc28e11C7E5d00877B7B444e834524AB814";
const BINANCE_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";

const useWeb3 = (): Web3Type => {
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [auctionHouseContract, setAuctionHouseContract] = useState<Contract>();
  const [auctionViewContract, setAuctionViewContract] = useState<Contract>();
  const [fantosiDAOLogicContract, setFantosiDAOLogicContract] =
    useState<Contract>();
  const [account, setAccount] = useState<string>("");
  const [wallets, setWallets] = useState<WalletState[]>([]);

  const getOnboard = async () => {
    if (!web3) {
      await getWeb3();
    }

    const injected = injectedModule();

    const onboard = Onboard({
      wallets: [injected],
      chains: [
        {
          id: "0x38",
          token: "BNB",
          label: "Binance Smart Chain Mainnet",
          rpcUrl: "https://bscrpc.com",
        },
        {
          id: "0x61",
          token: "tBNB",
          label: "Binance Smart Chain Testnet",
          rpcUrl: "https://data-seed-prebsc-2-s2.binance.org:8545",
        },
      ],
      accountCenter: {
        desktop: {
          position: "bottomRight",
          enabled: true,
          minimal: true,
        },
        mobile: {
          position: "bottomRight",
          enabled: true,
          minimal: true,
        },
      },
    });
    return onboard;
  };

  const getWeb3 = async () => {
    try {
      const provider = new Web3.providers.HttpProvider(BINANCE_TESTNET_RPC);
      const web3 = new Web3(provider);
      setWeb3(web3);
    } catch (e) {
      console.log(e);
    }
  };

  const signInWithWeb3Onboard = async (): Promise<string | undefined> => {
    const onboard = await getOnboard();
    const connectedWallet = await onboard.connectWallet();
    setWallets(connectedWallet);

    if (connectedWallet[0]) {
      const address = connectedWallet[0].accounts[0].address;
      // create an ethers provider with the last connected wallet provider
      const ethersProvider = new ethers.providers.Web3Provider(
        connectedWallet[0].provider,
        "any"
      );

      const signer = ethersProvider.getSigner();

      setAccount(address);
      setContracts();

      return address;
    }
    return undefined;
  };

  const signOutWithWeb3Onboard = async () => {
    const onboard = await getOnboard();

    if (!wallets) {
      return;
    }
    const [primaryWallet] = wallets;
    const result = await onboard.disconnectWallet({
      label: primaryWallet.label,
    });
  };

  const setContracts = () => {
    getAuctionHouse();
    getViewContract();
    getDAOLogicContract();
  };

  const getAuctionHouse = () => {
    try {
      if (window.ethereum) {
        const sendWeb3 = new Web3(window.ethereum as any);
        const abi = AuctionHouseArtifact.abi as AbiItem[];
        const ca: string = AUCTION_HOUSE_ADDR;
        const instance = new sendWeb3.eth.Contract(abi, ca);
        setAuctionHouseContract(instance);
      }
    } catch (e) {
      throw new Error(`getAuctionHouse ::: ERROR ${e}`);
    }
  };

  const getViewContract = () => {
    if (!web3) {
      getWeb3();
      return;
    }
    const abi = ViewArtifact.abi as AbiItem[];
    const ca: string = AUCTION_VIEW_ADDR;
    const instance = new web3.eth.Contract(abi, ca);
    setAuctionViewContract(instance);
  };

  const getDAOLogicContract = () => {
    try {
      if (window.ethereum) {
        const sendWeb3 = new Web3(window.ethereum as any);
        const abi = FantosiDAOLogicArtifact.abi as AbiItem[];
        const ca: string = FANTOSI_DAO_LOGIC_ADDR;
        const instance = new sendWeb3.eth.Contract(abi, ca);
        setFantosiDAOLogicContract(instance);
      }
    } catch (e) {
      throw new Error(`getAuctionHouse ::: ERROR ${e}`);
    }
  };

  const getTreasury = async (): Promise<string> => {
    if (!web3) {
      getWeb3();
      console.log(`getTreasury ::: web3 is not initiated`);
      return "0";
    }
    // get balance from address dao excutor
    const balance = await web3.eth.getBalance(FANTOSI_DAO_EXCUTER_ADDR);
    if (!balance) {
      console.log(`getTreasury ::: balance is not initiated`);
      return "0";
    }

    return web3.utils.fromWei(balance, "ether");
  };

  const createBid = async (photoCardId: number, bidAmount: number) =>
    new Promise<void>(async (resolve, reject) => {
      if (web3 === undefined) {
        throw new Error("createBid ::: not initiated web3");
      }

      if (auctionHouseContract === undefined) {
        throw new Error("createBid ::: not initiated auction house contract");
      }
      const weiAmount = web3.utils.toWei(bidAmount.toString(), "ether");
      await auctionHouseContract.methods
        .createBid(photoCardId)
        .send({
          from: account,
          value: weiAmount,
        })
        .on("transactionHash", (hash: string) => {
          console.log(`transactionHash: ${hash}`);
        })
        .on("receipt", (receipt: any) => {
          console.log(`receipt: ${receipt}`);
          resolve();
        })
        .on("confirmation", (confirmationNumber: number, receipt: any) => {
          console.log(`confirmation: ${confirmationNumber}`);
        })
        .on("error", (error: any, receipt: any) => {
          console.log(`error: ${error}`);
          reject();
        });
    });

  const getAllArtistInfo = async (): Promise<ArtistInfo[]> => {
    if (web3 === undefined) {
      throw new Error("getAllArtistInfo ::: not initiated web3");
    }

    if (auctionViewContract === undefined) {
      throw new Error(
        "getAllArtistInfo ::: not initiated auction view contract"
      );
    }

    const res: ArtistInfo[] = [];
    const ls = await auctionViewContract.methods.getAllArtistInfo().call();
    res.push(...ls);
    return res;
  };

  const getAllPhotoCardInfo = async (): Promise<PhotoCardInfo[]> => {
    if (web3 === undefined) {
      throw new Error("getAllPhotoCardInfo ::: not initiated web3");
    }

    if (auctionViewContract === undefined) {
      throw new Error(
        "getAllPhotoCardInfo ::: not initiated auction view contract"
      );
    }

    const res: PhotoCardInfo[] = [];
    const ls = await auctionViewContract.methods.getAllPhotoCardInfo().call();
    if (ls) {
      res.push(...ls);
    }
    return res;
  };

  const getArtistPhotoCardInfo = async (
    artistKey: string
  ): Promise<PhotoCardInfo | null> => {
    if (web3 === undefined) {
      throw new Error("getArtistPhotoCardInfo ::: not initiated web3");
    }

    if (auctionViewContract === undefined) {
      throw new Error(
        "getArtistPhotoCardInfo ::: not initiated auction view contract"
      );
    }

    const photoCard = await auctionViewContract.methods
      .getArtistPhotoCardInfo(artistKey)
      .call();
    return photoCard ? photoCard : null;
  };

  const getArtistPhotoCardHistoryInfo = async (
    artistKey: string
  ): Promise<PhotoCardInfo[]> => {
    if (web3 === undefined) {
      throw new Error("getArtistPhotoCardHistoryInfo ::: not initiated web3");
    }

    if (auctionViewContract === undefined) {
      throw new Error(
        "getArtistPhotoCardHistoryInfo ::: not initiated auction view contract"
      );
    }

    const res: PhotoCardInfo[] = [];
    const ls = await auctionViewContract.methods
      .getArtistPhotoCardHistoryInfo(artistKey)
      .call();

    if (ls) {
      res.push(...ls);
    }

    return res;
  };

  const getArtistAllProposalInfo = async (
    artistKey: string
  ): Promise<ProposalInfo[]> => {
    if (web3 === undefined) {
      throw new Error("getArtistPhotoCardHistoryInfo ::: not initiated web3");
    }

    if (auctionViewContract === undefined) {
      throw new Error(
        "getArtistPhotoCardHistoryInfo ::: not initiated auction view contract"
      );
    }

    const res: ProposalInfo[] = [];
    const ls = await auctionViewContract.methods
      .getArtistAllProposalInfo(artistKey)
      .call();
    if (ls) {
      res.push(...ls);
    }

    return res;
  };

  const submitPropose = async (
    targetAddress: string,
    amount: string,
    idea: string
  ) =>
    new Promise<void>((resolve, reject) => {
      if (fantosiDAOLogicContract === undefined) {
        throw new Error("propose ::: not initiated fantosi dao logic contract");
      }
      const makeProposal: MakeProposal = {
        targets: [targetAddress],
        values: [BigNumber.from(amount)],
        signatures: ["transfer(address,uint256)"],
        calldatas: [
          encodeParameters(["address", "uint256"], [targetAddress, amount]),
        ],
        idea,
      };

      fantosiDAOLogicContract.methods
        .propose(
          makeProposal.targets,
          makeProposal.values,
          makeProposal.signatures,
          makeProposal.calldatas,
          makeProposal.idea
        )
        .send({
          from: account,
        })
        .on("transactionHash", (hash: string) => {
          console.log(`transactionHash: ${hash}`);
        })
        .on("receipt", (receipt: any) => {
          console.log(`receipt: ${receipt}`);
          resolve();
        })
        .on("confirmation", (confirmationNumber: number, receipt: any) => {
          console.log(`confirmation: ${confirmationNumber}`);
        })
        .on("error", (error: any, receipt: any) => {
          console.log(`error: ${error}`);
          reject();
        });
    });

  const encodeParameters = (types: string[], values: unknown[]): string => {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
  };

  const castVote = async (proposalId: number, voteKind: VoteKind) =>
    new Promise<boolean>((resolve, reject) => {
      if (fantosiDAOLogicContract === undefined) {
        throw new Error(
          "castVote ::: not initiated fantosi dao logic contract"
        );
      }

      fantosiDAOLogicContract.methods
        .castVote(proposalId, voteKind.valueOf())
        .send({
          from: account,
        })
        .on("transactionHash", (hash: string) => {
          console.log(`transactionHash: ${hash}`);
        })
        .on("receipt", (receipt: any) => {
          console.log(`receipt: ${receipt}`);
          resolve(true);
        })
        .on("confirmation", (confirmationNumber: number, receipt: any) => {
          console.log(`confirmation ${confirmationNumber}`);
        })
        .on("error", (error: any, receipt: any) => {
          console.log(`error: ${error}`);
          reject(false);
        });
    });

  useEffect(() => {
    getWeb3();
  }, [account]);

  useEffect(() => {
    if (web3) {
      setContracts();
    }
  }, [web3]);

  return {
    signInWithWeb3Onboard,
    signOutWithWeb3Onboard,
    account,
    createBid,
    getAllArtistInfo,
    getAllPhotoCardInfo,
    getArtistPhotoCardInfo,
    getArtistPhotoCardHistoryInfo,
    web3Utils: web3?.utils,
    getArtistAllProposalInfo,
    submitPropose,
    castVote,
    getTreasury,
  };
};

export default useWeb3;
