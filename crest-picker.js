(() => {
  const resets = [];
  document.querySelectorAll('.crest-picker').forEach(panel => {
    const side = panel.dataset.side;
    const query = panel.querySelector('input');
    const button = panel.querySelector('button');
    const status = panel.querySelector('.crest-status');
    const results = panel.querySelector('.crest-results');
    const preview = panel.querySelector('.crest-preview');
    const target = document.getElementById('jogoLogo'+side);
    const team = document.getElementById('jogo'+side);
    let controller, generation = 0;
    function showPreview() {
      preview.replaceChildren();
      const url = target.value.trim();
      if (!/^https?:\/\//i.test(url)) return;
      const img = document.createElement('img'); img.src = url; img.alt = 'Escudo selecionado';
      img.addEventListener('error', () => { preview.textContent = 'Não foi possível exibir esse link. Confira o endereço do escudo.'; });
      const text = document.createElement('span'); text.textContent = 'Escudo selecionado';
      const clear = document.createElement('button'); clear.type='button'; clear.textContent='Remover';
      clear.onclick = () => { target.value=''; showPreview(); };
      preview.append(img,text,clear);
    }
    target.addEventListener('input',showPreview);
    async function search() {
      const q = (query.value.trim() || team.value.trim());
      if(q.length<2 || q.length>100){status.textContent='Digite entre 2 e 100 caracteres para buscar.'; return;}
      query.value=q;
      controller?.abort(); controller=new AbortController(); const current=++generation;
      results.replaceChildren(); status.textContent='Buscando escudos…'; button.disabled=true;
      try {
        const response=await fetch(API_URL+'/escudos?q='+encodeURIComponent(q),{signal:controller.signal});
        const body=await response.json();
        if(!response.ok) throw new Error(body.erro||'Busca indisponível. Use o link manual.');
        if(current!==generation)return;
        const items=Array.isArray(body.items)?body.items:[];
        status.textContent=items.length?'Escolha o escudo correto. Confira a imagem antes de selecionar.':'Nenhum escudo encontrado. Tente o nome completo ou cole o link manualmente.';
        items.forEach(item=>{
          if(!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(item.url))return;
          const choice=document.createElement('button');choice.type='button';choice.className='crest-choice';
          const img=document.createElement('img');img.src=item.url;img.alt='';img.loading='lazy';
          img.onerror=()=>{choice.disabled=true;choice.title='Imagem indisponível';};
          const name=document.createElement('span');name.textContent=item.name;
          choice.append(img,name);
          choice.onclick=()=>{target.value=item.url;target.dispatchEvent(new Event('input',{bubbles:true}));results.replaceChildren();status.textContent='Escudo selecionado. Nome do jogo preservado.';};
          results.append(choice);
        });
      } catch(error) { if(error.name!=='AbortError'&&current===generation) status.textContent=error.message||'Erro na busca. Use o link manual.'; }
      finally {if(current===generation)button.disabled=false;}
    }
    button.onclick=search;
    query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search();}});
    resets.push(()=>{generation++;controller?.abort();button.disabled=false;target.value='';query.value='';results.replaceChildren();preview.replaceChildren();status.textContent='';});
    showPreview();
  });
  window.resetCrestPickers=()=>resets.forEach(reset=>reset());
})();
