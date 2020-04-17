const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
// TODO delete abis first
try {
  fs.mkdirSync("./abis");
} catch (e) {}
const contractsInfo = JSON.parse(fs.readFileSync(args[0]).toString());
const contracts = contractsInfo.contracts;
for (const contractName of Object.keys(contracts)) {
  const contractInfo = contracts[contractName];
  fs.writeFileSync(path.join("abis", contractName + ".json"), JSON.stringify(contractInfo.abi));
}
