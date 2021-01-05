import { store, Address, Bytes, EthereumValue, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch, AssetContract } from "../generated/Asset/AssetContract";
import { AssetToken, Owner, AssetCollection, All } from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";
import { AssetTokenOwned } from "../generated/schema";
import { AssetTokenOwned } from "../generated/schema";

let zeroAddress = "0x0000000000000000000000000000000000000000";

export function handleTransferBatch(event: TransferBatch): void {
  let values = event.params.values;
  let ids = event.params.ids;
  for (let i = 0; i < event.params.ids.length; i++) {
    handleTransfer(event.block.timestamp, event.address, event.params.from, event.params.to, ids[i], values[i]);
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  let tokenId = event.params.id;
  handleTransfer(event.block.timestamp, event.address, event.params.from, event.params.to, tokenId, event.params.value);
}

function handleTransfer(
  timestamp: BigInt,
  contractAddress: Address,
  fromAddress: Bytes,
  toAddress: Bytes,
  tokenId: BigInt,
  quantity: BigInt
): void {
  let id = tokenId.toString();
  let from = fromAddress.toHex();
  let to = toAddress.toHex();
  let contract = AssetContract.bind(contractAddress);

  let all = All.load('all');
  if (all == null) {
      all = new All('all');
      all.numLands = BigInt.fromI32(0);
      all.numLandsMinted = BigInt.fromI32(0);
      all.numAssets = BigInt.fromI32(0);
      all.numAssetCollections = BigInt.fromI32(0);
      // all.numLandOwners = BigInt.fromI32(0); // TODO
      // all.numAssetOwners = BigInt.fromI32(0); // TODO
  }
  all.lastUpdate = timestamp;

  let currentOwner = Owner.load(from);
  if (currentOwner != null) {
    currentOwner.numAssets = currentOwner.numAssets.minus(quantity);

    let assetTokenOwned = AssetTokenOwned.load(from + '_' + id);
    if (assetTokenOwned == null) {
      log.error("assetTokenOwned is null : {}", [from + '_' + id]);
    } else {
      assetTokenOwned.quantity = assetTokenOwned.quantity.minus(quantity);
      if (assetTokenOwned.quantity.le(BigInt.fromI32(0))) {
        let assetTokens = currentOwner.assetTokens;
        let index = assetTokens.indexOf(from + '_' + id);
        assetTokens.splice(index, 1);
        currentOwner.assetTokens = assetTokens;
        log.error("deleting AssetTokenOwned {collectionId}", [assetTokenOwned.id]);
        store.remove("AssetTokenOwned", assetTokenOwned.id);
      } else {
        log.error("saving AssetTokenOwned {collectionId}", [assetTokenOwned.id]);
        assetTokenOwned.save();
      }
    }
    log.error("saving currentOnwer {collectionId}", [currentOwner.id]);
    currentOwner.save();
  }

  let newOwner = Owner.load(to);
  if (newOwner == null) {
    newOwner = new Owner(to);
    newOwner.timestamp = timestamp;
    newOwner.numLands = BigInt.fromI32(0);
    newOwner.landTokens = [];
    newOwner.numAssets = BigInt.fromI32(0);
    newOwner.assetTokens = [];
  }

  let collectionId: BigInt;
  let owner: string = null;
  let ownerCall = contract.try_ownerOf(tokenId);
  if (!ownerCall.reverted) {
    owner = ownerCall.value.toHex();
  }
  if (owner != null) {
    let collectionIdCall = contract.try_collectionOf(tokenId);
    if (!collectionIdCall.reverted) {
      collectionId = collectionIdCall.value;
    } else {
      collectionId = tokenId; // a dual token minted as NFT straight away is its own collection
    }
  } else {
    collectionId = tokenId;
  }

  let collection = AssetCollection.load(collectionId.toString());
  if (collection == null) {
    collection = new AssetCollection(collectionId.toString());
    let metadataURI = contract.try_uri(collectionId);
    if (!metadataURI.reverted) {
      collection.tokenURI = metadataURI.value;
    } else {
      log.error("error tokenURI from {id} {collectionId}", [id, collectionId.toString()]);
      collection.tokenURI = "error"; // SHOULD NEVER REACH THERE
    }
    collection.timestamp = timestamp;
    collection.supply = BigInt.fromI32(0);

    all.numAssetCollections = all.numAssetCollections.plus(BigInt.fromI32(1));
  }

  // collection.numOwners = BigInt.fromI32(0); // TODO
  if (from == zeroAddress && to != zeroAddress) {
    collection.supply = collection.supply.plus(quantity);
  }

  if(from != zeroAddress && to == zeroAddress) {
    collection.supply = collection.supply.minus(quantity);
  }
  log.error("saving collection {collectionId}", [collectionId.toString()]);
  collection.save();


  let assetToken = AssetToken.load(id);
  if (assetToken == null) {
    assetToken = new AssetToken(id);
    assetToken.timestamp = timestamp;
    assetToken.supply = BigInt.fromI32(0);
    assetToken.collection = collectionId.toString();
    // assetToken.numOwners = BigInt.fromI32(0); // TODO
    let rarity = contract.try_rarity(tokenId);
    if (!rarity.reverted) {
      assetToken.rarity = rarity.value.toI32();
    } else {
      assetToken.rarity = -1; // SHOULD NEVER REACH THERE
    }
    assetToken.owner = owner;
  }

  if (to != zeroAddress) {
    if (from == zeroAddress) {
      assetToken.supply = assetToken.supply.plus(quantity);
      all.numAssets = all.numAssets.plus(quantity);
    }

    let newOwnerTokens = newOwner.assetTokens;
    let assetTokenOwned: AssetTokenOwned | null = null;
    for (let i = 0; i < newOwnerTokens.length; i++) {
      if (newOwnerTokens[i] == to + '_' + id) {
        assetTokenOwned = AssetTokenOwned.load(to + '_' + id);
        break;
      }
    }
    if (assetTokenOwned == null) {
      assetTokenOwned = new AssetTokenOwned(to + '_' + id);
      assetTokenOwned.token = id;
      assetTokenOwned.quantity = BigInt.fromI32(0);
      newOwnerTokens.push(to + '_' + id);
      newOwner.assetTokens = newOwnerTokens;
    }
    assetTokenOwned.quantity =  assetTokenOwned.quantity.plus(quantity);
    log.error("saving assetTokenOwned {id}", [assetTokenOwned.id]);
    assetTokenOwned.save();

    newOwner.numAssets = newOwner.numAssets.plus(quantity);
    // TODO numAssetCollections ?
    log.error("saving newOwner {id}", [newOwner.id]);
    newOwner.save();
  } else {
    assetToken.supply = assetToken.supply.minus(quantity); // TODO detect ERC721 extraction
    all.numAssets = all.numAssets.minus(quantity);
  }
  log.error("saving assetToken {id}", [assetToken.id]);
  assetToken.save();
  log.error("saving all {id}", [all.id]);
  all.save();
}
