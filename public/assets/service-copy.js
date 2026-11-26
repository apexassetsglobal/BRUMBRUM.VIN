// Extractive TextRank ranks the owner's sentences and preserves the selected facts in their original order.
export function summarizeFacts(input,limit=3){
 const sentences=String(input||'').trim().split(/(?<=[.!?])\s+(?=\p{L})|[\n\r]+/u).map(x=>x.trim()).filter(Boolean).slice(0,70);
 if(sentences.length<=limit)return sentences.join(' ');
 const tokens=sentences.map(s=>new Set((s.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]))),df=new Map();
 for(const set of tokens)for(const word of set)df.set(word,(df.get(word)||0)+1);
 const n=sentences.length,weights=tokens.map(set=>new Map([...set].map(w=>[w,1+Math.log((n+1)/(1+df.get(w)))])));
 const norms=weights.map(w=>Math.sqrt([...w.values()].reduce((a,v)=>a+v*v,0))||1);
 const edges=weights.map((w,i)=>weights.map((v,j)=>i===j?0:[...w].reduce((sum,[word,x])=>sum+x*(v.get(word)||0),0)/(norms[i]*norms[j])));
 const sums=edges.map(row=>row.reduce((a,v)=>a+v,0));
 let scores=Array(n).fill(1/n);
 for(let k=0;k<16;k++)scores=scores.map((_,i)=>.15/n+.85*scores.reduce((sum,s,j)=>sum+s*(sums[j]?edges[j][i]/sums[j]:1/n),0));
 const chosen=[];for(let k=0;k<limit;k++){
  let best=-1,bestScore=-Infinity;
  for(let j=0;j<n;j++){if(chosen.includes(j))continue;const redundancy=Math.max(0,...chosen.map(x=>edges[x][j]));const rank=scores[j]*(1-.72*redundancy)+.015/(j+1);
   if(rank>bestScore){best=j;bestScore=rank;}}
  if(best>=0)chosen.push(best);
 }
 return chosen.sort((a,b)=>a-b).map(i=>sentences[i]).join(' ');
}
export function localBusinessDraft(description,name,city,categories=[]){
 const intro=[String(name||'').trim(),String(city||'').trim()].filter(Boolean).join(' · ');
 const summary=summarizeFacts(description),services=categories.slice(0,4).filter(x=>!summary.toLowerCase().includes(String(x).toLowerCase()));
 return [intro,summary,services.join(' · ')].filter(Boolean).join('\n\n');
}
