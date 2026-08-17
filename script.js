// Inicializa o PeerJS
const peer = new Peer(); 

let localStream;
let currentCall;

// Pegando os elementos da tela
const myIdDisplay = document.getElementById('my-id');
const connectInput = document.getElementById('connect-id');
const callBtn = document.getElementById('call-btn');
const shareScreenBtn = document.getElementById('share-screen-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// 1. Quando o PeerJS conectar, ele nos dá um ID único
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
});

// 2. Ligar a câmera e microfone assim que abrir o site
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(err => alert('Por favor, permita o acesso à câmera e microfone!'));

// 3. Receber uma ligação
peer.on('call', call => {
    // Atende a ligação enviando nosso vídeo/áudio
    call.answer(localStream); 
    
    // Quando receber o vídeo do outro lado, coloca na tela
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
    });
    
    currentCall = call;
});

// 4. Fazer uma ligação
callBtn.addEventListener('click', () => {
    const remoteId = connectInput.value;
    if(!remoteId) return alert("Digite o código do seu amor!");

    // Liga para o ID e envia nosso vídeo/áudio
    const call = peer.call(remoteId, localStream);
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
    });
    
    currentCall = call;
});

// 5. Compartilhar a Tela
shareScreenBtn.addEventListener('click', () => {
    if(!currentCall) return alert("Vocês precisam estar em chamada primeiro!");

    navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
        const screenTrack = stream.getVideoTracks()[0];
        // Troca a trilha de vídeo da câmera pela trilha da tela
        const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(screenTrack);
        
        // Mostra a tela para nós mesmos também
        localVideo.srcObject = stream;

        // Quando parar de compartilhar, volta para a câmera normal
        screenTrack.onended = () => {
            const originalVideoTrack = localStream.getVideoTracks()[0];
            sender.replaceTrack(originalVideoTrack);
            localVideo.srcObject = localStream;
        };
    }).catch(err => console.log('Compartilhamento de tela cancelado.'));
});