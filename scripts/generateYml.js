const fs = require("fs");
const Handlebars = require("handlebars");

const args = process.argv.slice(2);
const contractsInfo = JSON.parse(fs.readFileSync(args[0]).toString());
const template = Handlebars.compile(fs.readFileSync("./templates/subgraph.yaml").toString());
const result = template(contractsInfo);
fs.writeFileSync("./subgraph.yaml", result);
