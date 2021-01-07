import { store, Address, Bytes, EthereumValue, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch, AssetContract } from "../generated/Asset/AssetContract";
import { AssetToken, Owner, AssetCollection, All } from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";

import { AssetTokenOwned } from "../generated/schema";

let ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

let ONE = BigInt.fromI32(1);
let ZERO = BigInt.fromI32(0);

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

  // ---------------------------------------------------------------------------------------------------------------
  // - STATS SETUP
  // ---------------------------------------------------------------------------------------------------------------
  let all = All.load('all');
  if (all == null) {
      all = new All('all');
      all.numLands = ZERO;
      all.numAssets = ZERO;
      all.numAssetCollections = ZERO;
      all.numLandOwners = ZERO;
      all.numAssetOwners = ZERO;
  }
  all.lastUpdate = timestamp;

  // ---------------------------------------------------------------------------------------------------------------
  // - TOKEN SETUP
  // ---------------------------------------------------------------------------------------------------------------
  let collection: AssetCollection | null;
  let assetToken = AssetToken.load(id);
  if (assetToken == null) {
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

    assetToken = new AssetToken(id);
    assetToken.timestamp = timestamp;
    assetToken.supply = ZERO;
    assetToken.isNFT = owner != null; // owner will be set in if (to != ZERO_ADDRESS)
    assetToken.collection = collectionId.toString();

    // assetToken.numOwners = ZERO; // TODO
    let rarity = contract.try_rarity(tokenId);
    if (!rarity.reverted) {
      assetToken.rarity = rarity.value.toI32();
    } else {
      assetToken.rarity = -1; // SHOULD NEVER REACH THERE
    }


    collection = AssetCollection.load(assetToken.collection);
    if (collection == null) {
      collection = new AssetCollection(assetToken.collection);
      collection.numTokenTypes = ZERO;
      let metadataURI = contract.try_uri(collectionId);
      if (!metadataURI.reverted) {
        collection.tokenURI = metadataURI.value;
      } else {
        log.error("error tokenURI from {id} {collectionId}", [id, collectionId.toString()]);
        collection.tokenURI = "error"; // SHOULD NEVER REACH THERE
      }
      collection.timestamp = timestamp;
      collection.supply = ZERO;

      all.numAssetCollections = all.numAssetCollections.plus(ONE);
    }

    collection.numTokenTypes = collection.numTokenTypes.plus(ONE);
  } else {
    collection = AssetCollection.load(assetToken.collection);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // - FROM OTHER ACCOUNTS : TRANSFER OR BURN
  // ---------------------------------------------------------------------------------------------------------------
  if (from != ADDRESS_ZERO) {
    let currentOwner = Owner.load(from);
    if (currentOwner != null) {
      currentOwner.numAssets = currentOwner.numAssets.minus(quantity);
      if (currentOwner.numAssets.equals(ZERO)) {
        all.numAssetOwners = all.numAssetOwners.minus(ONE);
      }

      let assetTokenOwned = AssetTokenOwned.load(from + '_' + id);
      if (assetTokenOwned != null) {
        assetTokenOwned.quantity = assetTokenOwned.quantity.minus(quantity);
        if (assetTokenOwned.quantity.le(ZERO)) {
          store.remove("AssetTokenOwned", assetTokenOwned.id);
        } else {
          assetTokenOwned.save();
        }
      }
      currentOwner.save();
    } else {
      log.error("error from non existing owner {from} {id}", [from, id]);
    }
    collection.supply = collection.supply.minus(quantity);
    assetToken.supply = assetToken.supply.minus(quantity);
    all.numAssets = all.numAssets.minus(quantity);
  }


  // ---------------------------------------------------------------------------------------------------------------
  // - TO OTHER ACCOUNTS : TRANSFER OR MINT
  // ---------------------------------------------------------------------------------------------------------------
  if (to != ADDRESS_ZERO) {
    if (assetToken.isNFT) {
      assetToken.owner = to;
    }

    let newOwner = Owner.load(to);
    if (newOwner == null) {
      newOwner = new Owner(to);
      newOwner.timestamp = timestamp;
      newOwner.numLands = ZERO;
      newOwner.numAssets = ZERO;
    }

    collection.supply = collection.supply.plus(quantity);
    assetToken.supply = assetToken.supply.plus(quantity);
    all.numAssets = all.numAssets.plus(quantity);

    let assetTokenOwned = AssetTokenOwned.load(to + '_' + id);
    if (assetTokenOwned == null) {
      assetTokenOwned = new AssetTokenOwned(to + '_' + id);
      assetTokenOwned.owner = newOwner.id;
      assetTokenOwned.token = id;
      assetTokenOwned.quantity = ZERO;
    }
    assetTokenOwned.quantity =  assetTokenOwned.quantity.plus(quantity);
    assetTokenOwned.save();

    newOwner.numAssets = newOwner.numAssets.plus(quantity);
    if (newOwner.numAssets.equals(quantity)) {
      all.numAssetOwners = all.numAssetOwners.plus(ONE);
    }
    newOwner.save();
  } else {
    // ---------------------------------------------------------------------------------------------------------------
    // - TO ZERO ADDRESS: BURN (or void ?)
    // ---------------------------------------------------------------------------------------------------------------
    if (assetToken.isNFT) {
      store.remove("AssetToken", assetToken.id);
      collection.numTokenTypes = collection.numTokenTypes.minus(ONE);
    }
  }

  collection.save();
  assetToken.save();
  all.save();
}
