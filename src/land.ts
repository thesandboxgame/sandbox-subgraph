import { store, Address, Bytes, EthereumValue, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, LandContract } from "../generated/Land/LandContract";
import { LandToken, Owner } from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";

let zeroAddress = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  let tokenId = event.params._tokenId;
  let id = tokenId.toHex();
  // let contractId = event.address.toHex();
  let from = event.params._from.toHex();
  let to = event.params._to.toHex();
  let contract = LandContract.bind(event.address);

  let currentOwner = Owner.load(from);
  if (currentOwner != null) {
    currentOwner.numLands = currentOwner.numLands.minus(BigInt.fromI32(1));
    let landTokens = currentOwner.landTokens;
    let index = landTokens.indexOf(id);
    landTokens.splice(index, 1);
    currentOwner.landTokens = landTokens;
    currentOwner.save();
  }

  let newOwner = Owner.load(to);
  if (newOwner == null) {
    newOwner = new Owner(to);
    newOwner.timestamp = event.block.timestamp;
    newOwner.numLands = BigInt.fromI32(0);
    newOwner.landTokens = [];
    newOwner.numAssets = BigInt.fromI32(0);
    newOwner.assetTokens = [];
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
  if (to !== zeroAddress) {
    landToken.owner = event.params._to;
    landToken.save();

    let newOwnerTokens = newOwner.landTokens;
    newOwnerTokens.push(landToken.id);
    newOwner.landTokens = newOwnerTokens;
    newOwner.numLands = newOwner.numLands.plus(BigInt.fromI32(1));
    newOwner.save();
  } else {
    store.remove("LandToken", id);
  }
}
