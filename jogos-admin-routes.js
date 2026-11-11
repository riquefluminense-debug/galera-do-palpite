// Exclusive server route: credentials never leave the backend.
module.exports=function(app,autenticarAdmin,{url,key,fetcher=fetch}){
 app.delete('/api/admin/jogos/:id',autenticarAdmin,async(req,res)=>{
  if(!process.env.JWT_SECRET)return res.status(503).json({erro:'Configure JWT_SECRET no servidor.'});
  if(!req.admin?.usuario||!(req.admin.id||req.admin.modulo==='campeoes'))return res.status(403).json({erro:'Acesso de administrador necessário.'});
  const id=String(req.params.id||''),rodada=String(req.query.rodada_id||'');
  if(!/^[1-9]\d*$/.test(id)||! /^[1-9]\d*$/.test(rodada))return res.status(400).json({erro:'Jogo ou rodada inválidos.'});
  if(!url||!key)return res.status(503).json({erro:'Configure SUPABASE_URL e a chave secreta do servidor.'});
  async function db(table,query,method='GET'){
   const r=await fetcher(`${url}/rest/v1/${table}${query}`,{method,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'}});
   const data=await r.json().catch(()=>null);
   if(!r.ok||!Array.isArray(data))throw Error('Falha no banco. Confira a chave secreta do Supabase configurada somente no Render.');
   return data;
  }
  try{
   const found=await db('jogos',`?id=eq.${id}&rodada_id=eq.${rodada}&select=id`);
   if(!found.length)return res.status(404).json({erro:'Jogo não encontrado nesta rodada. Atualize a página.'});
   const tickets=await db('bilhetes',`?rodada_id=eq.${rodada}&select=id&limit=1`);
   if(tickets.length)return res.status(409).json({erro:'Esta rodada já possui bilhetes. Não é possível excluir jogos e alterar os palpites.'});
   const deleted=await db('jogos',`?id=eq.${id}&rodada_id=eq.${rodada}&select=id`,'DELETE');
   if(!deleted.some(j=>String(j.id)===id))return res.status(403).json({erro:'O banco não confirmou a exclusão. Configure no Render a chave service_role ou secreta do Supabase; não altere o DELETE público.'});
   const remaining=await db('jogos',`?id=eq.${id}&select=id`);
   if(remaining.length)throw Error('O jogo ainda aparece no banco.');
   res.json({ok:true,id});
  }catch(e){res.status(503).json({erro:e.message});}
 });
};
