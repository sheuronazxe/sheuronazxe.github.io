const bots = ["nightbot", "moobot", "streamelements", "streamLabs"];

const client = new tmi.Client();
const channelInput = document.getElementById("channel");
const toggle = document.getElementById("toggle");
const info = document.getElementById("info");
const voiceSelect = document.getElementById('voiceSelect');
const chat = document.getElementById('chat');
let voices;

channelInput.value = localStorage.getItem("channel");

// TTS ---

info.innerHTML = ('speechSynthesis' in window) ? "Your browser <strong>supports</strong> speech synthesis." : "Sorry your browser <strong>does not support</strong> speech synthesis.";

window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();

    voices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.text = voice.name;
        voiceSelect.appendChild(option);
    });
    const storedVoice = localStorage.getItem("selectedVoice");
    if (storedVoice !== null) voiceSelect.value = storedVoice;

    voiceSelect.onchange = () => {
        const selectedVoice = voiceSelect.options[voiceSelect.selectedIndex].value;
        const utterance = new SpeechSynthesisUtterance("Twitch Reader");
        utterance.voice = voices.find(voice => voice.name === selectedVoice);
        speechSynthesis.speak(utterance);
        localStorage.setItem("selectedVoice", selectedVoice);
    }
}

// CHAT ---

channelInput.addEventListener("input", () => {
    if (client.readyState() != "CLOSED") {
        client.disconnect();
        toggle.checked = false;
    }
    localStorage.setItem("channel", channelInput.value);
});

toggle.onchange = () => {
    client.channels = [channelInput.value];
    toggle.checked ? client.connect() : client.disconnect();
}

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

    if (!bots.includes(tags["display-name"])) {

        const selectedVoice = voiceSelect.options[voiceSelect.selectedIndex].value;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.voice = voices.find(voice => voice.name === selectedVoice);
        speechSynthesis.speak(utterance);

        const vmin = Math.min(window.innerWidth, window.innerHeight);
        const randomX = Math.floor(Math.random() * (window.innerWidth - (vmin * 0.4)));
        const randomY = Math.floor(Math.random() * (window.innerHeight - (vmin * 0.2)));

        const item = document.createElement("div");
        chat.appendChild(item);

        const rect = item.getBoundingClientRect();
        const topX = rect.width / 2 + vmin * .05
        const topY = rect.height / 2 + vmin * .05;
        const bottomX = window.innerWidth - rect.width / 2 - vmin * .05;
        const bottomY = window.innerHeight - rect.height / 2 - vmin * .05;

        item.style.position = "absolute";
        item.style.left = Math.random() * (bottomX - topX) + topX + "px";
        item.style.top = Math.random() * (bottomY - topY) + topY + "px";
        item.style.setProperty("--col", ("#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0")));
        item.innerHTML += "<div>" + tags["display-name"] + "</div>";
        item.innerHTML += "<div>" + message + "</div>";

        setTimeout(() => {
            chat.removeChild(item);
        }, 10000);

    }

});
