/* Independent accessible section toggles; no form values are removed. */
(()=>{
 const root=document.getElementById('adminConteudo');if(!root)return;
 const selector='.financeiro-admin,.card-admin,.campeoes-admin,#sportscore-panel';
 function enhance(section){
  if(section.dataset.collapseReady)return;
  const heading=section.querySelector('h2,h3');if(!heading)return;
  section.dataset.collapseReady='true';section.classList.add('admin-fold');
  let header=heading;while(header.parentElement!==section)header=header.parentElement;
  header.classList.add('admin-fold-header');
  const label=heading.textContent.trim();
  const key='gdp-admin-fold:'+label;
  const button=document.createElement('button');button.type='button';button.className='admin-fold-toggle';
  const body=document.createElement('div');body.className='admin-fold-body';body.id='admin-fold-'+(++count);
  for(const child of [...section.childNodes])if(child!==header)body.append(child);
  section.append(body);header.append(button);button.setAttribute('aria-controls',body.id);
  function set(closed){body.hidden=closed;button.textContent=closed?'⌄':'⌃';button.setAttribute('aria-expanded',String(!closed));button.setAttribute('aria-label',(closed?'Expandir ':'Recolher ')+label);section.classList.toggle('admin-fold-closed',closed)}
  let closed=false;try{closed=localStorage.getItem(key)==='closed'}catch{}
  set(closed);button.addEventListener('click',()=>{closed=!closed;set(closed);try{localStorage.setItem(key,closed?'closed':'open')}catch{}});
 }
 let count=0;
 function scan(){root.querySelectorAll(selector).forEach(enhance)}
 scan();new MutationObserver(scan).observe(root,{childList:true,subtree:true});
})();
