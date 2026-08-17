(function () {
"use strict";

var peer = null;
var localStream = null;
var currentCall = null;
var currentConn = null;
var screenTrack = null;
var myRoomCode = null;

function byId(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    var element = byId(id);
    if (element) {
        element.textContent = value;
    }
}

function toast(message) {
    var element = byId("toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () {
        element.classList.remove("show");
    }, 2600);
}

function randomCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var result = "";
    var i;
    for (i = 0; i < 8; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return "ENTRE-" + result;
}

function copyCode() {
    var code = myRoomCode || (peer && peer.id);
    if (!code) {
        toast("Gerando o código...");
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(function () {
            toast("Código copiado.");
        }).catch(function () {
            toast("Código: " + code);
        });
    } else {
        toast("Código: " + code);
    }
}

function setConnectionStatus(message) {
    setText("status-text", message);
    setText("connection-status", message);
}

function showScreen(name) {
    var screens = document.querySelectorAll(".screen");
    var buttons = document.querySelectorAll(".nav-item, .channel");
    var titles = {
        home: ["geral", "um lugar só de vocês"],
        call: ["cantinho", "voz e vídeo privados"],
        memories: ["memórias", "coisas que vocês querem guardar"],
        plans: ["planos", "ideias para fazer juntos"]
    };
    var i;

    for (i = 0; i < screens.length; i += 1) {
        screens[i].classList.add("hidden");
    }

    var screen = byId("screen-" + name);
    if (screen) {
        screen.classList.remove("hidden");
    }

    for (i = 0; i < buttons.length; i += 1) {
        buttons[i].classList.toggle("active", buttons[i].getAttribute("data-screen") === name);
    }

    if (titles[name]) {
        setText("page-title", titles[name][0]);
        setText("page-subtitle", titles[name][1]);
    }

    if (name === "call" && !localStream) {
        startMedia();
    }
}

function addMessage(text, mine) {
    var box = byId("messages");
    if (!box) return;

    var welcome = box.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    var item = document.createElement("div");
    item.className = "msg";

    var head = document.createElement("div");
    head.className = "msg-head";

    var avatar = document.createElement("span");
    avatar.className = "msg-avatar";
    avatar.textContent = mine ? "♥" : "♡";

    var author = document.createElement("b");
    author.textContent = mine ? "Você" : "Seu amor";

    var time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });

    head.appendChild(avatar);
    head.appendChild(author);
    head.appendChild(time);

    var body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = text;

    item.appendChild(head);
    item.appendChild(body);
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;

    var count = box.querySelectorAll(".msg").length;
    setText("message-count", count + (count === 1 ? " mensagem" : " mensagens"));
}

function startMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setConnectionStatus("Abra pelo HTTPS ou localhost para usar câmera");
        toast("Câmera/microfone precisam de HTTPS ou localhost.");
        return Promise.resolve(null);
    }

    return navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(function (stream) {
        localStream = stream;
        var video = byId("local-video");
        if (video) {
            video.srcObject = stream;
            video.muted = true;
            video.play().catch(function () {});
        }
        setConnectionStatus("Online • pronto para conectar");
        return stream;
    }).catch(function () {
        setConnectionStatus("Câmera/microfone não autorizados");
        toast("Permita câmera e microfone quando o navegador solicitar.");
        return null;
    });
}

function showTiles(show) {
    byId("empty-call").classList.toggle("hidden", show);
    byId("local-tile").classList.toggle("hidden", !show);
    byId("remote-tile").classList.toggle("hidden", !show);
}

function openConnection(connection) {
    if (!connection) return;
    currentConn = connection;

    connection.on("open", function () {
        setConnectionStatus("Conectado • chat privado ativo");
        setText("call-state", "Conectado");
    });

    connection.on("data", function (data) {
        if (data && data.type === "chat" && data.text) {
            addMessage(data.text, false);
        }
    });

    connection.on("close", function () {
        if (currentConn === connection) currentConn = null;
    });
}

function bindCall(call) {
    currentCall = call;
    showTiles(true);
    setConnectionStatus("Em chamada • conexão privada");
    setText("call-state", "Em chamada");

    call.on("stream", function (stream) {
        var video = byId("remote-video");
        if (video) {
            video.srcObject = stream;
            video.play().catch(function () {});
        }
        var placeholder = byId("remote-tile").querySelector(".video-placeholder");
        if (placeholder) placeholder.style.display = "none";
    });

    call.on("close", function () {
        endCall();
    });

    call.on("error", function () {
        toast("A chamada foi interrompida.");
        endCall();
    });
}

function endCall() {
    if (screenTrack) {
        stopShare();
    }

    if (currentCall) {
        try { currentCall.close(); } catch (e) {}
    }

    currentCall = null;
    var remote = byId("remote-video");
    if (remote) remote.srcObject = null;

    var placeholder = byId("remote-tile").querySelector(".video-placeholder");
    if (placeholder) placeholder.style.display = "";

    showTiles(false);
    setConnectionStatus("Chamada encerrada");
}

function connectToPerson() {
    var input = byId("connect-id");
    var id = input ? input.value.trim() : "";

    if (!id) {
        toast("Digite o código da outra pessoa.");
        return;
    }

    if (!peer || peer.destroyed || peer.disconnected) {
        toast("A conexão ainda está iniciando. Aguarde alguns segundos.");
        initPeer();
        return;
    }

    if (!localStream) {
        startMedia().then(function (stream) {
            if (stream) connectToPerson();
        });
        return;
    }

    if (id === peer.id) {
        toast("Esse é o seu próprio código.");
        return;
    }

    var call = peer.call(id, localStream);
    if (!call) {
        toast("Não foi possível iniciar a chamada.");
        return;
    }

    bindCall(call);

    var connection = peer.connect(id);
    openConnection(connection);
    toast("Conectando à chamada...");
}

function shareScreen() {
    if (!currentCall) {
        toast("Entre em uma chamada primeiro.");
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast("Seu navegador não permite compartilhar a tela.");
        return;
    }

    navigator.mediaDevices.getDisplayMedia({ video: true }).then(function (display) {
        screenTrack = display.getVideoTracks()[0];

        var sender = null;
        if (currentCall.peerConnection) {
            var senders = currentCall.peerConnection.getSenders();
            var i;
            for (i = 0; i < senders.length; i += 1) {
                if (senders[i].track && senders[i].track.kind === "video") {
                    sender = senders[i];
                    break;
                }
            }
        }

        if (sender) {
            return sender.replaceTrack(screenTrack).then(function () {
                byId("local-video").srcObject = display;
                toast("Tela sendo compartilhada.");
            });
        }

        byId("local-video").srcObject = display;
        toast("Tela sendo compartilhada.");

        return null;
    }).then(function () {
        if (screenTrack) {
            screenTrack.onended = stopShare;
        }
    }).catch(function () {
        toast("Compartilhamento cancelado.");
    });
}

function stopShare() {
    if (!screenTrack) return;

    var cameraTrack = localStream && localStream.getVideoTracks()[0];
    var sender = null;

    if (currentCall && currentCall.peerConnection) {
        var senders = currentCall.peerConnection.getSenders();
        var i;
        for (i = 0; i < senders.length; i += 1) {
            if (senders[i].track && senders[i].track.kind === "video") {
                sender = senders[i];
                break;
            }
        }
    }

    if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack).catch(function () {});
    }

    screenTrack.stop();
    screenTrack = null;

    if (localStream) {
        byId("local-video").srcObject = localStream;
    }
}

function toggleMic() {
    if (!localStream) {
        toast("O microfone ainda não está disponível.");
        return;
    }

    var tracks = localStream.getAudioTracks();
    if (!tracks.length) return;

    var enabled = !tracks[0].enabled;
    var i;
    for (i = 0; i < tracks.length; i += 1) {
        tracks[i].enabled = enabled;
    }

    setText("mic-label", enabled ? "Ligado" : "Desligado");
    setText("local-mic", enabled ? "🎙" : "🔇");
    toast(enabled ? "Microfone ligado" : "Microfone desligado");
}

function toggleCamera() {
    if (!localStream) {
        toast("A câmera ainda não está disponível.");
        return;
    }

    var tracks = localStream.getVideoTracks();
    if (!tracks.length) return;

    var enabled = !tracks[0].enabled;
    var i;
    for (i = 0; i < tracks.length; i += 1) {
        tracks[i].enabled = enabled;
    }

    setText("camera-label", enabled ? "Ligada" : "Desligada");
    toast(enabled ? "Câmera ligada" : "Câmera desligada");
}

function initPeer() {
    if (typeof window.Peer === "undefined") {
        setConnectionStatus("Servidor de chamada indisponível");
        toast("Não foi possível carregar o serviço de chamada. Verifique a internet.");
        return;
    }

    if (peer && !peer.destroyed) {
        try { peer.destroy(); } catch (e) {}
    }

    // A code is shown immediately, then the same ID is used when PeerJS connects.
    myRoomCode = randomCode();
    setText("my-id", myRoomCode);
    setText("my-id-side", myRoomCode);
    setConnectionStatus("Gerando conexão segura...");

    peer = new window.Peer(myRoomCode);

    peer.on("open", function (id) {
        myRoomCode = id;
        setText("my-id", id);
        setText("my-id-side", id);
        setConnectionStatus("Online • pronto para conectar");
    });

    peer.on("call", function (call) {
        showScreen("call");

        if (!localStream) {
            startMedia().then(function (stream) {
                if (stream) {
                    call.answer(stream);
                    bindCall(call);
                }
            });
        } else {
            call.answer(localStream);
            bindCall(call);
        }
    });

    peer.on("connection", function (connection) {
        openConnection(connection);
    });

    peer.on("disconnected", function () {
        setConnectionStatus("Reconectando...");
        try { peer.reconnect(); } catch (e) {}
    });

    peer.on("close", function () {
        setConnectionStatus("Conexão encerrada");
    });

    peer.on("error", function (error) {
        var type = error && error.type ? error.type : "desconhecido";
        if (type === "unavailable-id") {
            toast("Código ocupado. Gerando outro...");
            setTimeout(initPeer, 400);
        } else {
            setConnectionStatus("Erro de conexão");
            toast("Erro de conexão: " + type);
        }
    });
}

function bindEvents() {
    var buttons = document.querySelectorAll("[data-screen]");
    var i;

    for (i = 0; i < buttons.length; i += 1) {
        buttons[i].addEventListener("click", function () {
            showScreen(this.getAttribute("data-screen"));
        });
    }

    byId("hero-call").onclick = function () { showScreen("call"); };
    byId("open-call").onclick = function () { showScreen("call"); };
    byId("close-call").onclick = function () { showScreen("home"); };

    byId("hero-copy").onclick = copyCode;
    byId("copy-id").onclick = copyCode;
    byId("copy-top").onclick = copyCode;
    byId("copy-side").onclick = copyCode;

    byId("call-btn").onclick = connectToPerson;
    byId("mic-btn").onclick = toggleMic;
    byId("camera-btn").onclick = toggleCamera;
    byId("share-screen-btn").onclick = shareScreen;
    byId("hangup-btn").onclick = endCall;
    byId("mute-self").onclick = toggleMic;

    byId("message-form").onsubmit = function (event) {
        event.preventDefault();
        var input = byId("message-input");
        var text = input.value.trim();
        if (!text) return;

        addMessage(text, true);

        if (currentConn && currentConn.open) {
            currentConn.send({ type: "chat", text: text });
        }

        input.value = "";
    };

    byId("feature-screen").onclick = function () {
        showScreen("call");
        setTimeout(shareScreen, 250);
    };

    byId("side-search").oninput = function () {
        var query = this.value.toLowerCase();
        var channels = document.querySelectorAll(".channel");
        var j;
        for (j = 0; j < channels.length; j += 1) {
            channels[j].style.display =
                channels[j].textContent.toLowerCase().indexOf(query) !== -1 ? "flex" : "none";
        }
    };

    byId("settings").onclick = function () {
        toast("As configurações rápidas ficam nos controles da chamada.");
    };

    byId("server-menu").onclick = function () {
        toast("Espaço privado • somente vocês.");
    };

    byId("theme-btn").onclick = function () {
        toast("O tema principal desta versão é o dark.");
    };
}

function boot() {
    bindEvents();
    setConnectionStatus("Iniciando...");
    startMedia();
    initPeer();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}

window.addEventListener("beforeunload", function () {
    if (localStream) {
        var tracks = localStream.getTracks();
        for (var i = 0; i < tracks.length; i += 1) {
            tracks[i].stop();
        }
    }
});
}());
