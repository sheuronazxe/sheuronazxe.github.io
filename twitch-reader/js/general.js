const client = new tmi.Client();
const channelInput = document.getElementById("channel");
const toggle = document.getElementById("toggle");
const info = document.getElementById("info");
const voiceSelect = document.getElementById('voiceSelect');
const chat = document.getElementById('chat');
const volumeInput = document.getElementById("volume");
const bannedDiv = document.getElementById('bannedDiv');
const bannedUsers = JSON.parse(localStorage.bannedUsers || '["Nightbot", "Moobot", "StreamElements", "Streamlabs"]');

channelInput.value = localStorage.channel || "";
volumeInput.value = localStorage.volume || 1;


// TTS ---

info.innerHTML = ("speechSynthesis" in window) ? "Your browser <strong>supports</strong> speech synthesis." : "Sorry your browser <strong>does not support</strong> speech synthesis.";

let voices = [];

function populateVoiceList() {
    voices = window.speechSynthesis.getVoices();
    voices.forEach((voice) => {
        const option = document.createElement("option");
        option.text = voice.name;
        voiceSelect.appendChild(option);
    });

    voiceSelect.selectedIndex = localStorage.selectedVoice || voiceSelect.selectedIndex;

    voiceSelect.onchange = () => {
        speak("Twitch Reader");
        localStorage.selectedVoice = voiceSelect.selectedIndex;
    };
};
populateVoiceList();
if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = populateVoiceList;

function speak(msg) {
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.voice = voices[voiceSelect.selectedIndex];
    utterance.volume = parseFloat(volumeInput.value);
    window.speechSynthesis.speak(utterance);
    localStorage.selectedVoice = voiceSelect.selectedIndex;
};

volumeInput.onchange = () => localStorage.volume = volumeInput.value;


// CHAT ---

channelInput.addEventListener("input", () => {
    if (client.readyState() != "CLOSED") {
        client.disconnect();
        toggle.checked = false;
    }
    localStorage.channel = channelInput.value;
});

toggle.onchange = () => {
    client.channels = [channelInput.value];
    toggle.checked ? client.connect() : client.disconnect();
};

client.on("connecting", (address, port) => {
    info.innerHTML = "Connecting to " + address;
});

client.on("connected", (address, port) => {
    info.innerHTML = "Connected...";
});

client.on("disconnected", (reason) => {
    speechSynthesis.cancel();
    info.innerHTML = "Disconnected";
});

client.on("join", (channel, username, self) => {
    info.innerHTML = "Joined " + channel;
});

client.on('message', (channel, tags, message, self) => {

    if (!bannedUsers.includes(tags["display-name"])) {

        speak(message);

        const item = document.createElement("div");
        const topX = 140;
        const topY = 40;
        const bottomX = window.innerWidth - 140;
        const bottomY = window.innerHeight - 40;

        item.className = "chatMessaje";
        item.style.position = "absolute";
        item.style.left = Math.random() * (bottomX - topX) + topX + "px";
        item.style.top = Math.random() * (bottomY - topY) + topY + "px";
        item.style.setProperty("--col", ("#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0")));
        item.innerHTML += "<span>" + tags["display-name"] + "</span>";
        item.innerHTML += "<div>" + message + "</div>";
        chat.appendChild(item);

        setTimeout(() => { chat.removeChild(item) }, 10000);

    }

});


// IGNORE USERS ---

bannedUsers.forEach(value => updateBanned(value));

function updateBanned(name) {
    const user = document.createElement("span");
    user.innerHTML = name;
    user.onclick = (e) => {
        bannedDiv.removeChild(e.currentTarget);
        bannedUsers.splice(bannedUsers.indexOf(name),1);
        localStorage.bannedUsers = JSON.stringify(bannedUsers);
    };
    bannedDiv.appendChild(user);
};

function addBanned(user) {
    if (user) {
        updateBanned(user);
        bannedUsers.push(user);
        localStorage.bannedUsers = JSON.stringify(bannedUsers);
    };
};
