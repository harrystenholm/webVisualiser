const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

let audioCtx, analyser, data, hue;
let spikeHeights = new Array(60).fill(0);
let currentSize = 150;
const numSpikes = 60;
const gravity = 2.0;
const numTrails = 12;
let trailItems = [];
let frameCount = 0
const frameGap = 2

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
    frameCount++;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 600;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    // initialise outline
    let currentFramePoints = [];
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

        currentFramePoints.push({
            x: x,
            y: y
        });
    }

    // update trail items
    if (frameCount % frameGap === 0) {
        trailItems.push(currentFramePoints);
        if (trailItems.length > numTrails) trailItems.shift();
    }

    trailItems.forEach((points, index) => {
        let opacity = (index + 1) / (trailItems.length + 1);
        ctx.strokeStyle = `hsla(${hue}, 80%, 50%, ${opacity * 0.5})`;
        ctx.lineWidth = 3 + (index * 0.3);

        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
    });

    // initialise ellipse
    let bassAvg = data[0] / 255; 
    let targetSize = 10 + (bassAvg * 100);
    currentSize += (targetSize - currentSize) * 0.2; // Lerp

    // initiliase colour changing
    // (0 is red, 120 is green, 240 is blue)
    hue = 200 + (bassAvg * 100)

    ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.6)`;
    ctx.beginPath();
    ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Spikes with Gravity
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.beginPath();

    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

overlay.addEventListener('click', () => {
    if (!audioCtx) stream();
});