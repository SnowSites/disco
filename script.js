const $=id=>document.getElementById(id);
let peer=null,localStream=null,currentCall=null,currentConn=null,screenTrack=null;
const toast=t=>{const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove("show"),2300)};
const setText=(id,t)=>{const e=$(id);if(e)e.textContent=t};
function copyCode(){const id=peer?.id;if(!id)return toast("Seu código ainda está sendo gerado.");navigator.clipboard?.writeText(id).then(()=>toast("Código copiado.")).catch(()=>toast("Código: "+id))}
function setOnline(t="Online • pronto para conectar"){setText("status-text",t);setText("connection-status",t);setText("call-state",t.includes("chamada")?"Em chamada":"Pronto")}
function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.add("hidden"));
  $("screen-"+name).classList.remove("hidden");
  document.querySelectorAll(".nav-item,.channel").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));
  const titles={home:["geral","um lugar só de vocês"],call:["cantinho","voz e vídeo privados"],memories:["memórias","coisas que vocês querem guardar"],plans:["planos","ideias para fazer juntos"]};
  setText("page-title",titles[name][0]);setText("page-subtitle",titles[name][1]);
  if(name==="call" && !localStream) startMedia();
}
function addMessage(text,me=false){
  const box=$("messages");box.querySelector(".welcome-message")?.remove();
  const d=document.createElement("div");d.className="msg";
  const now=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  d.innerHTML=`<div class="msg-head"><span class="msg-avatar">${me?"♥":"♡"}</span><b>${me?"Você":"Seu amor"}</b><time>${now}</time></div><div class="msg-body"></div>`;
  d.querySelector(".msg-body").textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight;
  const n=box.querySelectorAll(".msg").length;setText("message-count",`${n} mensagem${n===1?"":"ns"}`);
}
async function startMedia(){
  if(!navigator.mediaDevices?.getUserMedia){setText("status-text","Navegador sem suporte a câmera");toast("Este navegador não oferece suporte à câmera.");return;}
  try{
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    $("local-video").srcObject=localStream;
    setOnline();
  }catch{setText("status-text","Permissão de câmera necessária");toast("Permita câmera e microfone para usar as chamadas.")}
}
function showTiles(show=true){
  $("empty-call").classList.toggle("hidden",show);
  $("local-tile").classList.toggle("hidden",!show);
  $("remote-tile").classList.toggle("hidden",!show);
}
function openConnection(conn){
  currentConn=conn;
  conn.on("open",()=>{setText("connection-status","Conectado");setText("call-state","Conectado")});
  conn.on("data",d=>{if(d?.type==="chat")addMessage(d.text,false)});
  conn.on("close",()=>{currentConn=null});
}
function bindCall(call){
  currentCall=call;showTiles(true);setOnline("Em chamada • conexão privada");
  call.on("stream",stream=>{$("remote-video").srcObject=stream;$("remote-tile").querySelector(".video-placeholder")?.remove()});
  call.on("close",endCall);
  call.on("error",()=>{toast("A chamada foi interrompida.");endCall()});
}
function endCall(){
  if(screenTrack)stopShare();
  currentCall=null;$("remote-video").srcObject=null;showTiles(false);setOnline("Chamada encerrada");
}
function connect(){
  const id=$("connect-id").value.trim();
  if(!id)return toast("Digite o código da outra pessoa.");
  if(!localStream)return toast("Aguarde a câmera iniciar.");
  if(id===peer?.id)return toast("Esse é o seu próprio código.");
  const call=peer.call(id,localStream);bindCall(call);openConnection(peer.connect(id));toast("Conectando...");
}
async function shareScreen(){
  if(!currentCall)return toast("Entre em uma chamada primeiro.");
  try{
    const display=await navigator.mediaDevices.getDisplayMedia({video:true});
    screenTrack=display.getVideoTracks()[0];
    const sender=currentCall.peerConnection.getSenders().find(s=>s.track?.kind==="video");
    if(sender)await sender.replaceTrack(screenTrack);
    $("local-video").srcObject=display;
    screenTrack.onended=stopShare;toast("Tela sendo compartilhada.");
  }catch{toast("Compartilhamento cancelado.")}
}
async function stopShare(){
  if(!screenTrack)return;
  const cam=localStream?.getVideoTracks()[0];
  const sender=currentCall?.peerConnection?.getSenders().find(s=>s.track?.kind==="video");
  if(sender&&cam)await sender.replaceTrack(cam);
  screenTrack=null;if(localStream)$("local-video").srcObject=localStream;
}
function toggleMic(){
  const t=localStream?.getAudioTracks()[0];if(!t)return;
  t.enabled=!t.enabled;$("mic-btn").firstChild.textContent=t.enabled?"🎙":"🔇";$("local-mic").textContent=t.enabled?"🎙":"🔇";setText("mic-label",t.enabled?"Ligado":"Desligado");toast(t.enabled?"Microfone ligado":"Microfone desligado");
}
function toggleCamera(){
  const t=localStream?.getVideoTracks()[0];if(!t)return;
  t.enabled=!t.enabled;setText("camera-label",t.enabled?"Ligada":"Desligada");$("camera-btn").firstChild.textContent=t.enabled?"▣":"□";toast(t.enabled?"Câmera ligada":"Câmera desligada");
}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
$("hero-call").onclick=()=>showScreen("call");$("open-call").onclick=()=>showScreen("call");$("close-call").onclick=()=>showScreen("home");
$("hero-copy").onclick=copyCode;$("copy-id").onclick=copyCode;$("copy-top").onclick=copyCode;$("copy-side").onclick=copyCode;
$("call-btn").onclick=connect;$("mic-btn").onclick=toggleMic;$("camera-btn").onclick=toggleCamera;$("share-screen-btn").onclick=shareScreen;$("hangup-btn").onclick=()=>{currentCall?.close();endCall()};
$("mute-self").onclick=toggleMic;
$("message-form").onsubmit=e=>{e.preventDefault();const i=$("message-input"),t=i.value.trim();if(!t)return;addMessage(t,true);if(currentConn?.open)currentConn.send({type:"chat",text:t});i.value=""};
$("feature-screen").onclick=()=>{showScreen("call");setTimeout(shareScreen,100)};
$("side-search").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(".channel").forEach(c=>c.style.display=c.textContent.toLowerCase().includes(q)?"flex":"none")};
$("settings").onclick=()=>toast("Configurações rápidas disponíveis nos controles.");
$("server-menu").onclick=()=>toast("Espaço privado • somente vocês.");
$("theme-btn").onclick=()=>{document.body.classList.toggle("light");toast("Tema escuro é o visual principal desta interface.")};

function initPeer(){
  peer=new Peer();
  peer.on("open",id=>{
    setText("my-id",id);setText("my-id-side",id);setOnline();
  });
  peer.on("call",call=>{
    if(!localStream)return toast("Aguarde a câmera iniciar.");
    call.answer(localStream);bindCall(call);showScreen("call");
  });
  peer.on("connection",openConnection);
  peer.on("error",e=>toast("Erro de conexão: "+(e.type||"desconhecido")));
}
window.addEventListener("beforeunload",()=>localStream?.getTracks().forEach(t=>t.stop()));
startMedia();initPeer();
