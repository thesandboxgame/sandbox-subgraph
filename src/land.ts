import { store, Address, Bytes, EthereumValue, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, LandContract } from "../generated/Land/LandContract";
import { LandToken, Owner, All } from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";

let ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

let ONE = BigInt.fromI32(1);
let ZERO = BigInt.fromI32(0);

export function handleTransfer(event: Transfer): void {
  let tokenId = event.params._tokenId;
  let id = tokenId.toString();
  // let contractId = event.address.toHex();
  let from = event.params._from.toHex();
  let to = event.params._to.toHex();
  let contract = LandContract.bind(event.address);

  let all = All.load('all');
  if (all == null) {
      all = new All('all');
      all.numLands = ZERO;
      all.numAssets = ZERO;
      all.numAssetCollections = ZERO;
      all.numLandOwners = ZERO;
      all.numAssetOwners = ZERO;
  }
  all.lastUpdate = event.block.timestamp;

  if (from != ADDRESS_ZERO) {
    let currentOwner = Owner.load(from);
    if (currentOwner != null) {
      currentOwner.numLands = currentOwner.numLands.minus(ONE);
      currentOwner.save();
      if (currentOwner.numLands.equals(ZERO)) {
        all.numLandOwners = all.numLandOwners.minus(ONE);
      }
    } else {
      log.error("currentOwner does not exist! {from} {tokenId", [from, id]);
    }
    all.numLands = all.numLands.minus(ONE);
  }


  if (to !== ADDRESS_ZERO) {
    let newOwner = Owner.load(to);
    if (newOwner == null) {
      newOwner = new Owner(to);
      newOwner.timestamp = event.block.timestamp;
      newOwner.numLands = ZERO;
      newOwner.numAssets = ZERO;
    }

    let idAsNumber = i32(parseInt(id, 10));
    let landToken = LandToken.load(id);
    if (landToken == null) {
      landToken = new LandToken(id);
      landToken.timestamp = event.block.timestamp;
      landToken.x = idAsNumber % 408;
      landToken.y = i32(Math.floor(idAsNumber / 408));
      let metadataURI = contract.try_tokenURI(tokenId);
      if (!metadataURI.reverted) {
        landToken.tokenURI = metadataURI.value;
      } else {
        landToken.tokenURI = "error";
      }
    }

    landToken.owner = newOwner.id;
    landToken.save();

    newOwner.numLands = newOwner.numLands.plus(ONE);
    newOwner.save();

    if (newOwner.numLands.equals(ONE)) {
      all.numLandOwners = all.numLandOwners.plus(ONE);
    }

    all.numLands = all.numLands.plus(ONE);
  } else {
    store.remove("LandToken", id);
  }
  all.save();
}
