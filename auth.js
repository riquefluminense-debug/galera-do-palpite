async function protegerPaginaAdmin(){
  const token = localStorage.getItem('adminToken');
  if(!token){
    window.location.href='login-admin.html';
    return;
  }

  try{
    await verificarAdmin();
  }catch(e){
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsuario');
    alert('Sessão expirada. Faça login novamente.');
    window.location.href='login-admin.html';
  }
}

function sairPainelAdmin(){
  logoutAdmin();
}
