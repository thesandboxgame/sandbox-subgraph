import { store, Address, Bytes, EthereumValue, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch, AssetContract } from "../generated/Asset/AssetContract";
import { AssetToken, Owner } from "../generated/schema";

import { log } from "@graphprotocol/graph-ts";

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
  // let contractId = contractAddress.toHex();
  let from = fromAddress.toHex();
  let to = toAddress.toHex();
  let contract = AssetContract.bind(contractAddress);

  let currentOwner = Owner.load(from);
  if (currentOwner != null) {
    currentOwner.numAssets = currentOwner.numAssets.minus(quantity);

    // TODO AssetTokenOwned
    // let assetTokens = currentOwner.assetTokens;
    // let index = assetTokens.indexOf(id);
    // assetTokens.splice(index, 1);
    // currentOwner.assetTokens = assetTokens;
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

  let assetToken = AssetToken.load(id);
  if (assetToken == null) {
    assetToken = new AssetToken(id);
    assetToken.timestamp = timestamp;
    let metadataURI = contract.try_tokenURI(tokenId);
    if (!metadataURI.reverted) {
      assetToken.tokenURI = metadataURI.value;
    } else {
      assetToken.tokenURI = "error";
    }
    assetToken.supply = BigInt.fromI32(0);
  }

  if (to !== zeroAddress) {
    assetToken.supply = assetToken.supply.plus(quantity);

    // TODO AssetTokenOwned
    // let newOwnerTokens = newOwner.assetToken;
    // newOwnerTokens.push(assetToken.id);
    // newOwner.assetTokens = newOwnerTokens;
    newOwner.numAssets = newOwner.numAssets.plus(quantity);
    newOwner.save();
  } else {
    assetToken.supply = assetToken.supply.minus(quantity); // TODO detect ERC721 extraction
  }
  assetToken.save();
}
