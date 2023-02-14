import { BigInt, log, store } from "@graphprotocol/graph-ts";
import { LandContract, Transfer } from "../generated/Land/LandContract";
import { All, LandToken, Owner } from "../generated/schema";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const ONE = BigInt.fromI32(1);
const ZERO = BigInt.fromI32(0);

export function handleTransfer(event: Transfer): void {
  const all = getAll();
  all.lastUpdate = event.block.timestamp;
  updateCurrentOwner(all, event);
  updateNewOwner(all, event);
  all.save();
}

function getAll(): All {
  let all = All.load('all');
  if (all === null) {
    all = new All('all');
    all.numLands = ZERO;
    all.numAssets = ZERO;
    all.numAssetCollections = ZERO;
    all.numLandOwners = ZERO;
    all.numAssetOwners = ZERO;
  }
  return all;
}

function updateCurrentOwner(all: All, event: Transfer): void {
  let id = event.params._tokenId.toString();
  let from = event.params._from.toHex();
  if (from !== ADDRESS_ZERO) {
    let currentOwner = Owner.load(from);
    if (currentOwner !== null) {
      currentOwner.numLands = currentOwner.numLands.minus(ONE);
      currentOwner.save();
      if (currentOwner.numLands.equals(ZERO)) {
        all.numLandOwners = all.numLandOwners.minus(ONE);
      }
    } else {
      log.error("currentOwner does not exist! {} {}", [from, id]);
    }
    all.numLands = all.numLands.minus(ONE);
  }
}

function updateNewOwner(all: All, event: Transfer): void {
  const tokenId = event.params._tokenId;
  const id = tokenId.toString();
  const to = event.params._to.toHex();
  if (to === ADDRESS_ZERO) return store.remove("LandToken", id);
  const newOwner = getNewOwner(to, event);
  const landToken = getLandToken(tokenId, event);
  landToken.owner = newOwner.id;
  landToken.save();
  newOwner.numLands = newOwner.numLands.plus(ONE);
  newOwner.save();
  if (newOwner.numLands.equals(ONE)) all.numLandOwners = all.numLandOwners.plus(ONE);
  all.numLands = all.numLands.plus(ONE);
}

function getNewOwner(to: string, event: Transfer): Owner {
  let newOwner = Owner.load(to);
  if (newOwner === null) {
    newOwner = new Owner(to);
    newOwner.timestamp = event.block.timestamp;
    newOwner.numLands = ZERO;
    newOwner.numAssets = ZERO;
  }
  return newOwner;
}

function getLandToken(tokenId: BigInt, event: Transfer): LandToken {
  const id = tokenId.toString();
  const idAsNumber = i32(parseInt(id, 10));
  const contract = LandContract.bind(event.address);
  let landToken = LandToken.load(id);
  if (landToken === null) {
    landToken = new LandToken(id);
    landToken.timestamp = event.block.timestamp;
    landToken.x = idAsNumber % 408;
    landToken.y = i32(Math.floor(idAsNumber / 408));
    const metadataURI = contract.try_tokenURI(tokenId);
    if (!metadataURI.reverted) landToken.tokenURI = metadataURI.value;
    else landToken.tokenURI = "error";
  }
  return landToken;
}