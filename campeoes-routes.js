const {timingSafeEqual} = require('node:crypto');
const {montarTopCampeoes} = require('./campeoes-core');
module.exports = function(app, autenticarAdmin, config) {
  function igual(a,b) { const x=Buffer.from(a || ''), y=Buffer.from(b || ''); return x.length===y.length && timingSafeEqual(x,y); }
  async function banco(method='GET', dados, id) {
    if(!config.url || !config.key) throw new Error('Configure SUPABASE_URL e SUPABASE_KEY no servidor.');
    const query=id ? `?id=eq.${encodeURIComponent(id)}` : '?select=id,nome,valor_centavos&order=created_at.desc,id.asc';
    const resposta=await fetch(`${config.url}/rest/v1/campeoes_premios${query}`, {
      method, headers:{apikey:config.key, Authorization:`Bearer ${config.key}`, 'Content-Type':'application/json', Prefer:method==='POST'?'return=representation,resolution=merge-duplicates':'return=representation'},
      ...(dados ? {body:JSON.stringify(dados)} : {})
    });
    const resultado=await resposta.json().catch(()=>null);
    if(!resposta.ok) throw new Error('Não foi possível acessar os prêmios. Confira a tabela campeoes_premios e a chave do servidor.');
    return resultado;
  }
  const rota = fn => async(req,res) => {try {await fn(req,res);} catch(e) {res.status(503).json({erro:e.message});}};
  const protegerCampeoes = (req,res,next) => {
    if(!process.env.JWT_SECRET) return res.status(503).json({erro:'Configure JWT_SECRET no servidor.'});
    autenticarAdmin(req,res,()=>{if(req.admin.modulo!=='campeoes')return res.status(403).json({erro:'Confirme o acesso em Campeões.'});next();});
  };
  app.post('/api/campeoes/login',(req,res)=>{
    if(!process.env.JWT_SECRET || !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) return res.status(503).json({erro:'Configure ADMIN_USER e ADMIN_PASSWORD no Render para habilitar Campeões.'});
    if(!igual(req.body.usuario,process.env.ADMIN_USER) || !igual(req.body.senha,process.env.ADMIN_PASSWORD)) return res.status(401).json({erro:'Usuário ou senha inválidos.'});
    res.json({token:config.jwt.sign({usuario:process.env.ADMIN_USER,modulo:'campeoes'},config.jwtSecret,{expiresIn:'1h'})});
  });
  app.get('/api/campeoes',rota(async(req,res)=>res.json(montarTopCampeoes(await banco()))));
  app.get('/api/campeoes/premios',protegerCampeoes,rota(async(req,res)=>res.json(await banco())));
  function validar(body) {
    const nome=String(body.nome||'').trim().replace(/\s+/g,' ');
    if(nome.length>120 || nome.split(' ').length<2 || !Number.isSafeInteger(body.valor_centavos) || body.valor_centavos<=0 || body.valor_centavos>100000000) return null;
    return {nome,valor_centavos:body.valor_centavos};
  }
  for(const method of ['post','put']) app[method]('/api/campeoes/premios'+(method==='put'?'/:id':''),protegerCampeoes,rota(async(req,res)=>{
    const dados=validar(req.body); if(!dados) return res.status(400).json({erro:'Preencha nome e sobrenome e um valor positivo com até duas casas decimais.'});
    if(!/^[0-9a-f-]{36}$/i.test(req.body.id || req.params.id || '')) return res.status(400).json({erro:'Identificador inválido.'});
    const salvo=await banco(method==='post'?'POST':'PATCH',method==='post'?{...dados,id:req.body.id}:dados,method==='put'?req.params.id:undefined);
    if(method==='put' && !salvo?.length) return res.status(404).json({erro:'Lançamento não encontrado.'});
    res.json(salvo);
  }));
  app.delete('/api/campeoes/premios/:id',protegerCampeoes,rota(async(req,res)=>{
    if(!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({erro:'Identificador inválido.'});
    await banco('DELETE',null,req.params.id);res.json({ok:true});
  }));
};
