const peer = new Peer();
let localStream=null,currentCall=null,currentConn=null,screenTrack=null;
const $=id=>document.getElementById(id);
const myId=$("my-id"), statusText=$("status-text"), connectionStatus=$("connection-status");
const localVideo=$("local-video"),remoteVideo=$("remote-video"),localCard=$("local-card"),remoteCard=$("remote-card"),emptyState=$("empty-state");
const connectInput=$("connect-id"),callBtn=$("call-btn"),micBtn=$("mic-btn"),cameraBtn=$("camera-btn"),shareBtn=$("share-screen-btn"),hangupBtn=$("hangup-btn");
const toast=t=>{const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove("show"),2200)};
function setStatus(text,online=false){statusText.textContent=text;connectionStatus.textContent=text;$("chat-state").textContent=online?"● online":"● offline";$("chat-state").classList.toggle("online",online)}
async function startMedia(){try{localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});localVideo.srcObject=localStream;localCard.classList.remove("hidden");setStatus("Câmera e microfone prontos");}catch(e){setStatus("Permita câmera e microfone para fazer chamadas");toast("Não foi possível acessar câmera/microfone")}}
function showCall(){emptyState.classList.add("hidden");localCard.classList.remove("hidden");remoteCard.classList.remove("hidden")}
function addMessage(text,me=false){const box=$("messages");const welcome=box.querySelector(".welcome");if(welcome)welcome.remove();const d=document.createElement("div");d.className="msg";const now=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});d.innerHTML=`<div class="msg-head"><span class="avatar" style="width:21px;height:21px;font-size:10px">${me?"♥":"♡"}</span><b>${me?"Você":"Seu amor"}</b><time>${now}</time></div><div class="msg-body"></div>`;d.querySelector(".msg-body").textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight}
function openData(conn){currentConn=conn;$("chat-state").textContent="● online";$("chat-state").classList.add("online");conn.on("data",data=>{if(data?.type==="chat")addMessage(data.text,false)});conn.on("close",()=>{currentConn=null;$("chat-state").textContent="● offline";$("chat-state").classList.remove("online")})}
peer.on("open",id=>{myId.textContent=id;setStatus("Online • pronto para conectar");});
peer.on("error",e=>{console.error(e);toast("Erro de conexão: "+(e.type||"desconhecido"));});
peer.on("call",call=>{if(!localStream){toast("Aguarde a câmera iniciar");return}call.answer(localStream);bindCall(call);});
peer.on("connection",conn=>{openData(conn)});
function bindCall(call){currentCall=call;showCall();setStatus("Em chamada",true);call.on("stream",stream=>{remoteVideo.srcObject=stream});call.on("close",endCall);call.on("error",()=>{toast("A chamada foi interrompida");endCall()})}
callBtn.onclick=()=>{const id=connectInput.value.trim();if(!id)return toast("Digite o código do seu amor");if(!localStream)return toast("Aguarde câmera e microfone iniciarem");if(id===peer.id)return toast("Esse é o seu próprio código");const call=peer.call(id,localStream);bindCall(call);try{openData(peer.connect(id))}catch{}};
micBtn.onclick=()=>{if(!localStream)return;const t=localStream.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;micBtn.textContent=t.enabled?"🎙":"🔇";$("local-mic").textContent=t.enabled?"🎙":"🔇";toast(t.enabled?"Microfone ligado":"Microfone desligado")};
cameraBtn.onclick=()=>{if(!localStream)return;const t=localStream.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;cameraBtn.textContent=t.enabled?"📹":"🚫";toast(t.enabled?"Câmera ligada":"Câmera desligada")};
shareBtn.onclick=async()=>{if(!currentCall)return toast("Conecte-se em uma chamada primeiro");try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true});screenTrack=stream.getVideoTracks()[0];const sender=currentCall.peerConnection.getSenders().find(s=>s.track?.kind==="video");if(sender)await sender.replaceTrack(screenTrack);localVideo.srcObject=stream;screenTrack.onended=stopShare;shareBtn.classList.add("sharing");toast("Compartilhamento de tela iniciado")}catch{toast("Compartilhamento cancelado")}};
async function stopShare(){if(!screenTrack)return;const cam=localStream?.getVideoTracks()[0];const sender=currentCall?.peerConnection?.getSenders().find(s=>s.track?.kind==="video");if(sender&&cam)await sender.replaceTrack(cam);screenTrack=null;if(localStream)localVideo.srcObject=localStream;shareBtn.classList.remove("sharing")}
hangupBtn.onclick=()=>{if(currentCall)currentCall.close();endCall()};
function endCall(){if(screenTrack)stopShare();currentCall=null;remoteVideo.srcObject=null;remoteCard.classList.add("hidden");emptyState.classList.remove("hidden");setStatus("Chamada encerrada");}
$("copy-id").onclick=$("copy-link").onclick=async()=>{if(!peer.id)return;await navigator.clipboard.writeText(peer.id);toast("Código copiado!")};
$("message-form").onsubmit=e=>{e.preventDefault();const input=$("message-input"),text=input.value.trim();if(!text)return;addMessage(text,true);if(currentConn?.open)currentConn.send({type:"chat",text});else toast("Mensagem salva apenas nesta sessão");input.value=""};
$("theme-btn").onclick=()=>{document.body.classList.toggle("light");$("theme-btn").textContent=document.body.classList.contains("light")?"☀":"☾"};
$("settings-btn").onclick=()=>toast("Configurações da sessão: aparência e chamada");
window.addEventListener("beforeunload",()=>localStream?.getTracks().forEach(t=>t.stop()));
startMedia();