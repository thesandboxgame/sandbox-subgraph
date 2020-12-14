import 'dotenv/config';
import 'isomorphic-unfetch';
import {createClient} from '@urql/core';

async function query<T>(queryString: string, field: string, variables: Record<string, unknown>): Promise<T[]> {
  const first = 100;
  let lastId = "0x0";
  let numEntries = first;
  let entries: T[]= [];
  while(numEntries === first) {
    const result = await client.query(queryString, {first, lastId, ...variables}).toPromise();
    const data = result.data;
    let newEntries = [];
    if (data) {
      newEntries = data[field];
    }
    if (!entries) {
      newEntries = [];
    }
    numEntries = newEntries.length;
    if (numEntries > 0) {
      const newLastId = newEntries[numEntries - 1].id;
      if (lastId === newLastId) {
        console.log("same query, stop");
        break;
      }
      lastId = newLastId;
    }
    entries = entries.concat(newEntries);
  }
  return entries
}

const client = createClient({
  url: 'https://api.thegraph.com/subgraphs/name/pixowl/the-sandbox',
});


const queryString = `
query($blockNumber: Int! $first: Int! $lastId: ID!) {
    owners(first: $first where: {numLands_gt: 0 id_gt: $lastId} block: {number: $blockNumber}) {
      id
      numLands
    }
}
`;

const blockNumber = 11438254; // Dec-12-2020 12:59:57 PM +UTC

(async() => {
    const landOwners = await query(queryString, "owners", {blockNumber});
    console.log(landOwners.length);
})()

