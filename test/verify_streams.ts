import fs from '../src/index';

console.log("Checking exports...");
if (typeof fs.createReadStream !== 'function') throw new Error("createReadStream missing");
if (typeof fs.createWriteStream !== 'function') throw new Error("createWriteStream missing");
if (typeof fs.ReadStream !== 'function') throw new Error("ReadStream class missing");
if (typeof fs.WriteStream !== 'function') throw new Error("WriteStream class missing");
if (!fs.promises) throw new Error("promises API missing");

console.log("Instantiating streams...");
const rs = fs.createReadStream("test.txt", { encoding: 'utf8' });
if (rs instanceof fs.ReadStream) console.log("ReadStream instance ok");
else throw new Error("ReadStream instance check failed");

const ws = fs.createWriteStream("test_out.txt");
if (ws instanceof fs.WriteStream) console.log("WriteStream instance ok");
else throw new Error("WriteStream instance check failed");

console.log("Verification checks passed!");
