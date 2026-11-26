import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, readFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const list=await readFile(resolve(root,'.backup/SHA256SUMS'),'utf8');
const rows=list.trimEnd().split('\n');
const seen=new Set();
for (const row of rows) {
  const match=/^([a-f0-9]{64})  (.+)$/.exec(row);
  if (!match) throw new Error('Błędny wiersz manifestu');
  const [,expected,name]=match;
  const path=resolve(root,name);
  if (!path.startsWith(root+sep)||seen.has(name)||!(await lstat(path)).isFile())
    throw new Error('Niepoprawna ścieżka: '+name);
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest('hex')!==expected) throw new Error('Plik różni się od eksportu: '+name);
  seen.add(name);
}
console.log('Zgodność SHA-256: '+seen.size+'/'+rows.length+' plików.');
