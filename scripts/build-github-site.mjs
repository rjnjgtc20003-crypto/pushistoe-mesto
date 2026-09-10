// A single content revision pins the HTML, module graph and fetched assets.
// GitHub Pages otherwise caches each unversioned module for up to ten minutes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const source=path.resolve('public/github-site');
const destination=path.resolve('outputs/github-pages');
const files=[];
async function visit(directory) {
  for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())await visit(filename);
    else if(entry.isFile())files.push(path.relative(source,filename));
  }
}
await visit(source);
files.sort();
const digest=createHash('sha256');
const contents=new Map();
for(const name of files) {
  let data=await fs.readFile(path.join(source,name));
  // Git's Windows CRLF checkout must produce the same revision as Linux CI.
  if(/\.(js|html|json|css|svg|md|txt)$/.test(name))data=Buffer.from(data.toString('utf8').replaceAll('\r\n','\n'));
  contents.set(name,data);
  digest.update(name.replaceAll(path.sep,'/')).update('\0').update(data);
}
const revision=digest.digest('hex').slice(0,16);
for(const [name,original] of contents) {
  let data=original;
  if(/\.(js|html)$/.test(name)) {
    data=original.toString('utf8').replace(
      /(['"])(\.\/[^'"\s]+\.(?:js|json|png|jpg|jpeg|webp))(?:\?[^'"]*)?\1/g,
      (_,quote,url)=>`${quote}${url}?v=${revision}${quote}`,
    );
  }
  const filename=path.join(destination,name);
  await fs.mkdir(path.dirname(filename),{recursive:true});
  await fs.writeFile(filename,data);
}
await fs.writeFile(path.join(destination,'build-info.json'),JSON.stringify({revision},null,2));
console.log(`Built ${files.length} files, revision ${revision}: ${destination}`);
