const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];

    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: {
      facingMode: "user",
    },
  };
  const cameraConstraints = {
    audio: true,
    video: {
      deviceId: { exact: deviceId },
    },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0]; //myStream
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video"); //상대방에게 보낼 stream
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
socket.on("welcome", async () => {
  /*
  [Peer A에서 진행 - 먼저 접속한 사람 -]
  1. getUserMedia()
  2. addStream() : 지금은 이거 대신 addTrack을 씀
  3. createOffer() : Offer 생성(이걸 이용해서 다른 사용자와 연결됨)
  4. setLocalDescription(offer)
  5. send offer to other user
  */
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
  console.log("sent the offer");

  //또 다른 유저가 접속했으므로 webRTC 과정 시작가능
});

socket.on("offer", async (offer) => {
  /*
  [Peer B에서 진행 - 나중에 접속한 사람 -]
  1. setRemoteDescription(offer)
  2. getUserMedia()
  3. addStream(): 지금은 이거 대신 addTrack을 씀
  4. createAnswer()
  5. setLocalDescription(answer)
  6. send answer
  */
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  /*
    [PeerA가 PeerB로부터 answer를 받고 나서 진행 -처음 접속한 사람-]
    1. setRemoteDescription(answer)
  */
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

// RTC Code
function makeConnection() {
  myPeerConnection = new RTCPeerConnection();
  //각 peer에서 서로 remoteDesciption에 offer와 answer를 추가해서 연결되면 icecandidate이벤트가 호출됨
  myPeerConnection.addEventListener("icecandidate", handleIce);
  /*
    각 peer가 연결되고, candidate도 교환되면 addstream이벤트가 발생함.
    addstream 이벤트에는 서로의 audio/video정보(stream)가 들어있음
  */
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

/*
  [RTC Ice Candidate]
  브라우저가 서로 소통할 수 있게 해주는 방법. 중재하는 프로세스. 
  어떤 소통방법이 가장 좋을지 제안할때 사용
  다수의 candidate들이 각각의 connection으로부터 제안되고 상호 동의하에 하나가 선택됨
*/
function handleIce(data) {
  /*
  Ice Candidate를 상대방에게 전송
  */
  socket.emit("ice", data.candidate, roomName);
  console.log("sent candidate");
}

function handleAddStream(data) {
  /*
    data : 상대방으로부터 받은 stream(audio/video 정보)가 있음. data.stream
  */
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
