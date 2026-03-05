const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

let audioCtx, analyser, data;
let spikeHeights = new Array(60).fill(0);
let currentSize = 150;
const numSpikes = 60;
const gravity = 2.0;

function stream() {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;

    data = new Uint8Array(analyser.frequencyBinCount);

    navigator.mediaDevices.getUserMedia({ audio: true}).then(stream => {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        overlay.style.display = 'none';
        draw();
    }).catch(err => console.error("Mic access denied:", err));
}

function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 600;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale)

    // 2. Circle Pulse (using low frequencies/bass)
    let bassAvg = data[0] / 255; 
    let targetSize = 150 + (bassAvg * 100);
    currentSize += (targetSize - currentSize) * 0.2; // Lerp

    ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Spikes with Gravity
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < numSpikes; i++) {
        let rawAmp = (data[i * 2] / 255) * 150;

        // Gravity logic
        if (rawAmp > spikeHeights[i]) spikeHeights[i] = rawAmp;
        else spikeHeights[i] = Math.max(0, spikeHeights[i] - gravity);

        let angle = (i / numSpikes) * Math.PI * 2;
        let r = (currentSize / 2) + spikeHeights[i];
        let x = Math.cos(angle) * r;
        let y = Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

overlay.addEventListener('click', () => {
    if (!audioCtx) stream();
});