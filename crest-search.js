// Wikipedia lookup through our backend: no API key or browser CORS dependency.
const cache = new Map();
async function searchCrests(query, fetcher = fetch) {
  const q = String(query || '').trim();
  if (q.length < 2 || q.length > 100) throw new Error('Digite entre 2 e 100 caracteres.');
  const key = q.toLocaleLowerCase('pt-BR');
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.items;
  const url = new URL('https://pt.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:q+' futebol',gsrnamespace:'0',gsrlimit:'12',prop:'pageimages|description',piprop:'thumbnail',pithumbsize:'160',pilicense:'any'});
  const response = await fetcher(url, {headers:{'User-Agent':'GaleraDoPalpite/1.0 (club crest search)'},signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Busca indisponível. Tente novamente ou use o link manual.');
  const body = await response.json();
  if (body.error) throw new Error('Busca indisponível. Use o link manual.');
  const items = Object.values(body.query?.pages || {}).sort((a,b)=>(a.index||0)-(b.index||0)).filter(p=>/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(p.thumbnail?.source || '')).map(p=>({name:p.title,description:p.description||'',url:p.thumbnail.source,source:'https://pt.wikipedia.org/?curid='+p.pageid}));
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key,{items,expires:Date.now()+3600000});
  return items;
}
module.exports = {searchCrests};
