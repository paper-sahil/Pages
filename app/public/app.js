document.addEventListener('DOMContentLoaded', function () {
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
    // // The Firebase SDK is initialized and available here!
    //
    // firebase.auth().onAuthStateChanged(user => { });
    // firebase.database().ref('/path/to/ref').on('value', snapshot => { });
    // firebase.messaging().requestPermission().then(() => { });
    // firebase.storage().ref('/path/to/ref').getDownloadURL().then(() => { });
    //
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

    try {
        let app = firebase.app();
        

    } catch (e) {
        console.error(e);
        document.write('Error loading the Firebase SDK, check the console.');
    }
});
function googleLogin() {
    const provider = new firebase.auth().GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            alert(`Hello ${user.displayName}`);
            console.log(result);
            console.log(user);
        }).catch(console.error);
}
// 3. Create the Vue instance
new Vue({
    el: '#app',
    data: {
        //   configKonva: {
        //     width: window.innerWidth,
        //     height: window.innerHeight,
        //   },
        //   configCircle: {
        //     x: 100,
        //     y: 100,
        //     radius: 70,
        //     fill: 'red',
        //     stroke: 'black',
        //     strokeWidth: 2
        //   }
    }
});
var $ = function (id) { return document.getElementById(id) };
let canvasEl = $('c');
var canvas = this.__canvas = new fabric.Canvas('c', {
    isDrawingMode: true,
    enablePointerEvents: true
});
var ctx = canvasEl.getContext('2d');
canvas.setWidth(window.innerWidth);
canvas.setHeight(window.innerHeight);
canvas.calcOffset();
fabric.Object.prototype.transparentCorners = false;
// Initialize a brush
let brush = new fabric.PSBrush(canvas);
brush.width = 10;
brush.color = "#f00";
canvas.freeDrawingBrush = brush;



if (canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush.shadow = new fabric.Shadow({
        blur: 0.5,
        offsetX: 0,
        offsetY: 0,
        affectStroke: true,
        color: '#000',
    });
}


mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let senderDataChannel = null;
let receiverDataChannel = null;
let localCanvasStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

function init() {
    document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#createBtn').addEventListener('click', createRoom);
    document.querySelector('#joinBtn').addEventListener('click', joinRoom);
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

async function createRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;
    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();

    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners();
    console.log(canvasEl);
    let localCanvasStream = canvasEl.captureStream();

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    peerConnection.addStream(localCanvasStream);

    senderDataChannel = peerConnection.createDataChannel("sender Data Channel");
    senderDataChannel.onopen = function () {
        alert('data sending on');
        canvas.on('object:added', (e) => { senderDataChannel.send(JSON.stringify(canvas)); });
        canvas.on('object:removed', (e) => { senderDataChannel.send(JSON.stringify(canvas)); });
        canvas.on('object:modified', (e) => { senderDataChannel.send(JSON.stringify(canvas)); });
    };
    senderDataChannel.onclose = function () { alert('data sending off'); };

    // Code for collecting ICE candidates below
    const callerCandidatesCollection = roomRef.collection('callerCandidates');

    peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    // Code for creating a room below
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Created offer:', offer);

    const roomWithOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
        },
    };
    await roomRef.set(roomWithOffer);
    roomId = roomRef.id;
    console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
    document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;
    // Code for creating a room above

    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            remoteStream.addTrack(track);
        });
    });

    // Listening for remote session description below
    roomRef.onSnapshot(async snapshot => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            console.log('Got remote description: ', data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
    // Listening for remote session description above

    // Listen for remote ICE candidates below
    roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
    // Listen for remote ICE candidates above
}

function joinRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;

    document.querySelector('#confirmJoinBtn').
        addEventListener('click', async () => {
            roomId = document.querySelector('#room-id').value;
            console.log('Join room: ', roomId);
            document.querySelector(
                '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
            await joinRoomById(roomId);
        }, { once: true });
    roomDialog.open();
}

var handleJsonEvent = (msg) => {
    canvas.clear().renderAll();
    canvas.loadFromJSON(msg.data);
    canvas.renderAll();
}

async function joinRoomById(roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
        console.log('Create PeerConnection with configuration: ', configuration);
        peerConnection = new RTCPeerConnection(configuration);
        peerConnection.ondatachannel = function (event) {
            receiverDataChannel = event.channel;
            receiverDataChannel.onmessage = handleJsonEvent;
            receiverDataChannel.onopen = () => { alert('receiver data channel on') };
            receiverDataChannel.onclose = () => { alert('receiver data channel off') };
        }
        registerPeerConnectionListeners();
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Code for collecting ICE candidates below
        const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
        peerConnection.addEventListener('icecandidate', event => {
            if (!event.candidate) {
                console.log('Got final candidate!');
                return;
            }
            console.log('Got candidate: ', event.candidate);
            calleeCandidatesCollection.add(event.candidate.toJSON());
        });
        // Code for collecting ICE candidates above

        peerConnection.addEventListener('track', event => {
            try {
                console.log('streams: ', event.streams);
                console.log('Got remote track:', event.streams[0]);
                event.streams[0].getTracks().forEach(track => {
                    console.log('Add a track to the remoteStream:', track);
                    remoteStream.addTrack(track);
                });
            } catch (error) {
                console.error(error);
            }

        });

        // Code for creating SDP answer below
        const offer = roomSnapshot.data().offer;
        console.log('Got offer:', offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        console.log('Created answer:', answer);
        await peerConnection.setLocalDescription(answer);

        const roomWithAnswer = {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
        await roomRef.update(roomWithAnswer);
        // Code for creating SDP answer above

        // Listening for remote ICE candidates below
        roomRef.collection('callerCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
        // Listening for remote ICE candidates above
    }
}

async function openUserMedia(e) {
    const stream = await navigator.mediaDevices.getUserMedia(
        { video: true, audio: true });
    document.querySelector('#localVideo').srcObject = stream;
    localStream = stream;
    remoteStream = new MediaStream();
    document.querySelector('#remoteVideo').srcObject = remoteStream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnection) {
        peerConnection.close();
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';

    // Delete room on hangup
    if (roomId) {
        const db = firebase.firestore();
        const roomRef = db.collection('rooms').doc(roomId);
        const calleeCandidates = await roomRef.collection('calleeCandidates').get();
        calleeCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        const callerCandidates = await roomRef.collection('callerCandidates').get();
        callerCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        await roomRef.delete();
    }

    document.location.reload(true);
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
            `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
            `ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

init();
