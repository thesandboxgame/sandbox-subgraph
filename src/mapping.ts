import {store, Address, Bytes, EthereumValue, BigInt, BigDecimal} from "@graphprotocol/graph-ts";
import {Transfer} from "../generated/Land/LandContract";
import {LandToken} from "../generated/schema";

import {log} from "@graphprotocol/graph-ts";

let zeroAddress = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  let id = event.params._tokenId.toString();
  let idAsNumber = i32(parseInt(id, 10));
  let landToken = LandToken.load(id);
  if (landToken == null) {
    landToken = new LandToken(id);
    landToken.owner = event.params._to;
    landToken.timestamp = event.block.timestamp;
    landToken.x = idAsNumber % 408;
    landToken.y = i32(Math.floor(idAsNumber / 408));
    landToken.tokenURI = "";
    landToken.save();
  }
}
