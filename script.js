
"use strict";
(function(){
var state={
  user:JSON.parse(localStorage.getItem("entre_nos_user")||"null"),
  avatar:"♥",
  peer:null, peerId:null, localStream:null, call:null, conn:null, screenTrack:null,
  inVoice:false, micOn:true, cameraOn:true, selectedChannel:"geral",
  memories:JSON.parse(localStorage.getItem("entre_nos_memories")||"[]"),
  plans:JSON.parse(localStorage.getItem("entre_nos_plans")||JSON.stringify([
    {text:"Escolher um filme para ver juntos",done:false},
    {text:"Fazer uma noite de chamada sem pressa",done:false},
    {text:"Planejar o próximo passeio",done:false}
  ]))
};

var $=function(id){return document.getElementById(id)};
function text(id,v){var e=$(id);if(e)e.textContent=v}
function toast(v){var e=$("toast");e.textContent=v;e.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(function(){e.classList.remove("show")},2600)}
function save(){localStorage.setItem("entre_nos_user",JSON.stringify(state.user));localStorage.setItem("entre_nos_memories",JSON.stringify(state.memories));localStorage.setItem("entre_nos_plans",JSON.stringify(state.plans))}
function avatars(){return ["♥","♡","✦","☻","✿","★"].map(function(a,i){return '<button type="button" class="avatar-option '+(i===0?"selected":"")+'" data-avatar="'+a+'">'+a+'</button>'}).join("")}
function setupLogin(){
 $("avatar-picker").innerHTML=avatars();
 $("avatar-picker").onclick=function(e){var b=e.target.closest("[data-avatar]");if(!b)return;document.querySelectorAll(".avatar-option").forEach(function(x){x.classList.remove("selected")});b.classList.add("selected");state.avatar=b.dataset.avatar};
 $("login-form").onsubmit=function(e){e.preventDefault();var n=$("login-name").value.trim();if(!n)return;state.user={name:n,avatar:state.avatar};save();openApp()};
}
function openApp(){
 $("login-screen").classList.add("hidden");$("app-shell").classList.remove("hidden");
 text("my-name",state.user.name);text("member-name",state.user.name);text("account-name-input",state.user.name);
 ["my-avatar","member-avatar","connection-avatar","call-local-avatar","voice-local-avatar","call-bottom-avatar"].forEach(function(id){text(id,state.user.avatar)});
 ["call-local-name","voice-local-name","call-bottom-name","connection-name"].forEach(function(id){text(id,state.user.name)});
 renderMemories();renderPlans();initPeer();refreshDevices();
}
function logout(){if(state.localStream)stopTracks();localStorage.removeItem("entre_nos_user");location.reload()}
function setView(name){
 document.querySelectorAll(".view").forEach(function(v){v.classList.add("hidden")});
 var v=$("view-"+name);if(v)v.classList.remove("hidden");
 text("top-icon",name==="geral"||name==="memorias"||name==="planos"?"#":"⚙");
 text("top-title",name==="geral"?"geral":name==="memorias"?"memórias":name==="planos"?"planos":name==="friends"?"Vocês dois":"Configurações");
 text("top-subtitle",name==="geral"?"um lugar só de vocês":name==="friends"?"conexão direta":"seu espaço privado");
 document.querySelectorAll(".channel[data-channel]").forEach(function(b){b.classList.toggle("active",b.dataset.channel===name)});
}
function openCall(){ $("call-view").classList.remove("hidden"); text("call-status","🔒 privado");}
function closeCall(){ $("call-view").classList.add("hidden")}
function renderVoice(){
 $("call-empty").classList.toggle("hidden",state.inVoice);
 $("video-grid").classList.toggle("hidden",!state.inVoice||!state.cameraOn);
 $("voice-only-grid").classList.toggle("hidden",!state.inVoice||state.cameraOn);
 text("call-bottom-state",state.inVoice?(state.call?"conectado":"no canal • aguardando"):"não conectado");
 text("voice-count",state.inVoice?"1":"0");
 var badge=$("share-badge");if(badge)badge.style.display=state.screenTrack?"block":"none";
}
function getMedia(video){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast("Abra este site em HTTPS ou localhost para usar câmera/microfone.");return Promise.resolve(null)}
 return navigator.mediaDevices.getUserMedia({audio:{deviceId:state.micId?{exact:state.micId}:undefined},video:video}).then(function(s){
  if(state.localStream)stopTracks();state.localStream=s;
  var v=$("local-video");v.srcObject=s;v.play().catch(function(){});
  state.cameraOn=video;state.micOn=true;renderVoice();return s
 }).catch(function(e){toast("Não foi possível acessar câmera/microfone: "+(e.name||"permissão"));return null})
}
function stopTracks(){if(state.localStream)state.localStream.getTracks().forEach(function(t){t.stop()});state.localStream=null}
function join(mode){
 openCall();
 var wantVideo=mode!=="audio";
 getMedia(wantVideo).then(function(s){if(!s)return;state.inVoice=true;renderVoice();toast(mode==="screen"?"Você entrou. Agora escolha a tela para transmitir.":"Você entrou no canal de voz.");if(mode==="screen")setTimeout(shareScreen,250)})
}
function connect(){
 var id=$("connect-code").value.trim();
 if(!id){toast("Cole um código de call.");return}
 if(!state.peer||!state.peer.open){toast("Seu código ainda está conectando.");return}
 if(!state.inVoice){join("audio");setTimeout(function(){connect()},800);return}
 if(!state.localStream){toast("Entre na call primeiro.");return}
 var call=state.peer.call(id,state.localStream);if(!call){toast("Não foi possível chamar.");return}
 bindCall(call);state.conn=state.peer.connect(id);bindConn(state.conn);toast("Conectando...")
}
function bindCall(call){
 state.call=call;state.inVoice=true;renderVoice();
 call.on("stream",function(s){var v=$("remote-video");v.srcObject=s;v.volume=Number($("volume-slider").value)/100;v.play().catch(function(){});$("remote-placeholder").style.display="none";text("call-status","● conectado");$("remote-member").querySelector("small").innerHTML='<i class="online-dot"></i> em call';$("voice-count").textContent="2";});
 call.on("close",function(){state.call=null;renderVoice();toast("A outra pessoa saiu da chamada.");$("remote-placeholder").style.display="flex";$("remote-member").querySelector("small").innerHTML='<i class="idle-dot"></i> aguardando'})
 call.on("error",function(){toast("Erro na chamada.")})
}
function bindConn(c){state.conn=c;c.on("open",function(){text("call-status","● conectado")});c.on("data",function(d){if(d&&d.type==="chat")addMessage(d.text,false)})}
function leave(){
 if(state.call)try{state.call.close()}catch(e){};state.call=null;if(state.conn)try{state.conn.close()}catch(e){};state.conn=null;if(state.screenTrack)stopShare();stopTracks();state.inVoice=false;renderVoice();closeCall();toast("Você saiu da call.")
}
function toggleMic(){
 if(!state.localStream){toast("Entre na call primeiro.");return}
 state.micOn=!state.micOn;state.localStream.getAudioTracks().forEach(function(t){t.enabled=state.micOn});$("mute-self").textContent=state.micOn?"🎙":"🔇";$("call-mic").classList.toggle("off",!state.micOn);toast(state.micOn?"Microfone ligado":"Microfone desligado")
}
function toggleCamera(){
 if(!state.localStream){toast("Entre na call primeiro.");return}
 var tracks=state.localStream.getVideoTracks();if(!tracks.length){toast("Você entrou somente com áudio.");return}
 state.cameraOn=!state.cameraOn;tracks.forEach(function(t){t.enabled=state.cameraOn});renderVoice();toast(state.cameraOn?"Câmera ligada":"Câmera desligada")
}
function shareScreen(){
 if(!state.inVoice){toast("Entre na call primeiro.");return}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){toast("Seu navegador não permite transmitir a tela.");return}
 navigator.mediaDevices.getDisplayMedia({video:true}).then(function(display){
  state.screenTrack=display.getVideoTracks()[0];var sender=null;
  if(state.call&&state.call.peerConnection){state.call.peerConnection.getSenders().some(function(s){if(s.track&&s.track.kind==="video"){sender=s;return true}return false});}
  if(state.call&&state.call.peerConnection){var ss=state.call.peerConnection.getSenders();for(var i=0;i<ss.length;i++)if(ss[i].track&&ss[i].track.kind==="video"){sender=ss[i];break}}
  if(sender)sender.replaceTrack(state.screenTrack);
  $("local-video").srcObject=display;$("local-video").play().catch(function(){});$("video-grid").classList.remove("hidden");$("voice-only-grid").classList.add("hidden");$("share-badge").style.display="block";toast("Você está transmitindo a tela.");state.screenTrack.onended=stopShare
 }).catch(function(){toast("Transmissão cancelada.")})
}
function stopShare(){if(!state.screenTrack)return;var cam=state.localStream&&state.localStream.getVideoTracks()[0];if(state.call&&state.call.peerConnection&&cam){var ss=state.call.peerConnection.getSenders();for(var i=0;i<ss.length;i++)if(ss[i].track&&ss[i].track.kind==="video"){ss[i].replaceTrack(cam);break}}state.screenTrack.stop();state.screenTrack=null;if(state.localStream)$("local-video").srcObject=state.localStream;$("share-badge").style.display="none";renderVoice()}
function setVolume(v){var val=Number(v);$("remote-video").volume=val/100;$("volume-slider").value=val;$("call-volume-slider").value=val;text("volume-value",val+"%");text("call-volume-value",val+"%")}
function refreshDevices(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return;
 navigator.mediaDevices.enumerateDevices().then(function(ds){
  var mic=$("mic-select"),sp=$("speaker-select");mic.innerHTML="";sp.innerHTML="";
  ds.filter(function(d){return d.kind==="audioinput"}).forEach(function(d,i){var o=document.createElement("option");o.value=d.deviceId;o.textContent=d.label||"Microfone "+(i+1);mic.appendChild(o)});
  ds.filter(function(d){return d.kind==="audiooutput"}).forEach(function(d,i){var o=document.createElement("option");o.value=d.deviceId;o.textContent=d.label||"Saída "+(i+1);sp.appendChild(o)});
  if(state.micId)mic.value=state.micId
 })
}
function changeMic(id){
 state.micId=id;if(!state.localStream)return;
 var audio=state.localStream.getAudioTracks()[0];if(!audio)return;
 navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:id}},video:false}).then(function(s){var newTrack=s.getAudioTracks()[0];var old=audio;var sender=null;if(state.call&&state.call.peerConnection){var ss=state.call.peerConnection.getSenders();for(var i=0;i<ss.length;i++)if(ss[i].track===old){sender=ss[i];break}}if(sender)sender.replaceTrack(newTrack);old.stop();state.localStream.addTrack(newTrack);toast("Microfone alterado.")}).catch(function(){toast("Não foi possível trocar o microfone.")})
}
function changeSpeaker(id){
 var v=$("remote-video");if(v&&typeof v.setSinkId==="function")v.setSinkId(id).then(function(){toast("Saída de áudio alterada.")}).catch(function(){toast("Seu navegador não permitiu trocar a saída.")});else toast("Seu navegador não suporta seleção de saída de áudio.")
}
function addMessage(t,mine){
 var box=$("messages"),item=document.createElement("div");item.className="msg";var h=document.createElement("div");h.className="msg-head";var a=document.createElement("span");a.className="msg-avatar";a.textContent=mine?state.user.avatar:"♡";var b=document.createElement("b");b.textContent=mine?state.user.name:"Seu amor";var tm=document.createElement("time");tm.textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});h.append(a,b,tm);var body=document.createElement("div");body.className="msg-body";body.textContent=t;item.append(h,body);box.appendChild(item);box.scrollTop=box.scrollHeight
}
function renderMemories(){var g=$("memory-grid");g.innerHTML=state.memories.map(function(m,i){return '<article class="memory-card"><div class="memory-heart">♥</div><h3>'+escapeHtml(m.title)+'</h3><p>'+escapeHtml(m.text)+'</p><time>'+escapeHtml(m.date)+'</time></article>'}).join("")||'<article class="memory-card"><div class="memory-heart">♡</div><h3>Nenhuma memória ainda</h3><p>Criem a primeira.</p></article>'}
function renderPlans(){var p=$("plans");p.innerHTML=state.plans.map(function(x,i){return '<div class="plan '+(x.done?"done":"")+'"><button class="plan-check" data-plan="'+i+'">'+(x.done?"✓":"")+'</button><div><b>'+escapeHtml(x.text)+'</b><small>para vocês dois</small></div></div>'}).join("")}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]})}
function modal(content){$("modal-content").innerHTML=content;$("generic-modal").classList.remove("hidden")}
function initPeer(){
 if(typeof Peer==="undefined"){text("my-code","indisponível");return}
 var id="ENTRE-"+Math.random().toString(36).slice(2,10).toUpperCase();state.peer=new Peer(id);text("my-code",id);
 state.peer.on("open",function(real){state.peerId=real;text("my-code",real)});
 state.peer.on("call",function(call){openCall();if(!state.inVoice){getMedia(false).then(function(s){if(s){state.inVoice=true;call.answer(s);bindCall(call);renderVoice()}})}else{call.answer(state.localStream);bindCall(call)}});
 state.peer.on("connection",bindConn);state.peer.on("disconnected",function(){try{state.peer.reconnect()}catch(e){}});state.peer.on("error",function(e){toast("Conexão: "+(e.type||"erro"))})
}
function quickMemory(){modal('<span class="eyebrow">NOVA MEMÓRIA</span><h2>Guardar uma memória</h2><label class="modal-label">Título</label><input class="modal-input" id="memory-title" placeholder="Ex.: nossa noite favorita"><label class="modal-label">Texto</label><textarea class="modal-input" id="memory-text" placeholder="Escreva alguma coisa..."></textarea><button class="primary" id="save-memory">Guardar</button>');$("save-memory").onclick=function(){var t=$("memory-title").value.trim(),x=$("memory-text").value.trim();if(!t)return;state.memories.unshift({title:t,text:x,date:new Date().toLocaleDateString("pt-BR")});save();renderMemories();$("generic-modal").classList.add("hidden");toast("Memória guardada.")}}
function initEvents(){
 $("login-name").value=state.user?state.user.name:"";setupLogin();
 if(state.user)openApp();
 document.querySelectorAll("[data-channel]").forEach(function(b){b.onclick=function(){var c=b.dataset.channel;if(b.dataset.kind==="voice"){openCall();return}setView(c)}})
 document.querySelectorAll("[data-view]").forEach(function(b){b.onclick=function(){setView(b.dataset.view)}})
 document.querySelectorAll("[data-mobile]").forEach(function(b){b.onclick=function(){var x=b.dataset.mobile;if(x==="call"){openCall();return}setView(x==="home"?"geral":x)}})
 $("top-join").onclick=function(){openCall()};$("join-audio").onclick=function(){join("audio")};$("join-video").onclick=function(){join("video")};$("join-screen").onclick=function(){join("screen")};$("leave-call").onclick=leave;$("minimize-call").onclick=closeCall;$("call-mic").onclick=toggleMic;$("call-camera").onclick=toggleCamera;$("call-screen").onclick=shareScreen;$("mute-self").onclick=toggleMic;
 $("call-volume").onclick=function(){$("call-volume-pop").classList.toggle("hidden")};$("call-volume-slider").oninput=function(){setVolume(this.value)};$("volume-slider").oninput=function(){setVolume(this.value)};$("mic-select").onchange=function(){changeMic(this.value)};$("speaker-select").onchange=function(){changeSpeaker(this.value)};
 $("connect-btn").onclick=connect;$("copy-code").onclick=$("copy-my-code").onclick=function(){var code=state.peerId||$("my-code").textContent;navigator.clipboard?navigator.clipboard.writeText(code).then(function(){toast("Código copiado.")}):toast(code)};
 $("message-form").onsubmit=function(e){e.preventDefault();var i=$("message-input"),t=i.value.trim();if(!t)return;addMessage(t,true);if(state.conn&&state.conn.open)state.conn.send({type:"chat",text:t});i.value=""};
 document.querySelectorAll("[data-quick]").forEach(function(b){b.onclick=function(){var q=b.dataset.quick;if(q==="call")openCall();if(q==="memory")quickMemory();if(q==="invite")$("copy-my-code").click()}})
 $("new-memory").onclick=quickMemory;$("new-plan").onclick=function(){modal('<span class="eyebrow">NOVO PLANO</span><h2>Adicionar plano</h2><label class="modal-label">O que vocês querem fazer?</label><input class="modal-input" id="plan-input" placeholder="Ex.: cozinhar juntos"><button class="primary" id="save-plan">Adicionar</button>');$("save-plan").onclick=function(){var x=$("plan-input").value.trim();if(!x)return;state.plans.push({text:x,done:false});save();renderPlans();$("generic-modal").classList.add("hidden")}};
 $("plans").onclick=function(e){var b=e.target.closest("[data-plan]");if(!b)return;state.plans[Number(b.dataset.plan)].done=!state.plans[Number(b.dataset.plan)].done;save();renderPlans()};
 $("new-server-btn").onclick=function(){modal('<span class="eyebrow">NOVO SERVIDOR</span><h2>Criar um espaço</h2><p class="muted">Crie outro espaço privado neste dispositivo.</p><label class="modal-label">Nome</label><input class="modal-input" id="server-name-input" placeholder="Ex.: nosso cantinho"><button class="primary" id="create-server">Criar servidor</button>');$("create-server").onclick=function(){var n=$("server-name-input").value.trim();if(!n)return;var el=document.createElement("button");el.className="server-pill";el.textContent=n.slice(0,2).toUpperCase();$("server-list").appendChild(el);$("generic-modal").classList.add("hidden");toast("Servidor criado.")}};
 $("modal-close").onclick=function(){$("generic-modal").classList.add("hidden")};$("channel-search").oninput=function(){var q=this.value.toLowerCase();document.querySelectorAll(".channel").forEach(function(c){c.style.display=c.textContent.toLowerCase().includes(q)?"flex":"none"})};
 $("user-settings-btn").onclick=function(){setView("settings")};$("app-settings-btn").onclick=function(){setView("settings")};$("call-settings").onclick=function(){setView("settings");closeCall()};$("save-account").onclick=function(){var n=$("account-name-input").value.trim();if(n){state.user.name=n;save();openApp();toast("Conta atualizada.")}};$("test-mic").onclick=function(){toast("Microfone selecionado. Fale para testar o nível.")};
 document.querySelectorAll(".setting-tab").forEach(function(b){b.onclick=function(){document.querySelectorAll(".setting-tab").forEach(function(x){x.classList.remove("active")});b.classList.add("active");document.querySelectorAll(".settings-section").forEach(function(x){x.classList.add("hidden")});$("settings-"+b.dataset.settings).classList.remove("hidden")}})
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initEvents);else initEvents();
})();
