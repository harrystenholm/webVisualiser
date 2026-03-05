const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

let audioCtx, analyser, data, hue, lightness;
let spikeHeights = new Array(60).fill(0);
let currentSize = 150;
const numSpikes = 60;
const gravity = 2.0;
const numTrails = 12;
let trailItems = [];
let frameCount = 0;
const frameGap = 2;
const themeInput = document.getElementById('colorTheme');
const modeInput = document.getElementById('mode');

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
    frameCount++;

    // retrieves theme and mode menu input value
    const theme = themeInput.value;
    const mode = modeInput.value;
    
    if (mode === 'waveform') {
        analyser.getByteTimeDomainData(data);
    } else if (mode === 'frequency') {
        analyser.getByteFrequencyData(data);
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 600;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    let currentFramePoints = [];

    //initialise volume and ellipse target size
    let bassAvg = data[0] / 255; 
    let targetSize = 10 + (bassAvg * 100);
    currentSize += (targetSize - currentSize) * 0.2; // Lerp

    // initiliase colour changing based on volume
    // (0 is red, 120 is green, 240 is blue)
    if (theme === 'ocean') {
        hue = 200 + (bassAvg * 100);
        lightness = 50;
    } else if (theme === 'fire') {
        hue = 0 + (bassAvg * 40);
        lightness = 60;
    } else if (theme === 'forest') {
        hue = 100 + (bassAvg * 40);
        lightness = 15;
    }
    
    ctx.beginPath();
    // initialise outline
    for (let i = 0; i < numSpikes; i++) {
        let rawAmp = 0;

        if (mode === 'waveform') {
            let waveId = Math.floor(i * (data.length / numSpikes));
            let amplitude = Math.abs(data[waveId] - 128) / 128;
            rawAmp = amplitude * 150;
        } else if (mode === 'frequency') {
            rawAmp = (data[i * 2] / 255) * 150;
        }

        // Gravity logic
        if (rawAmp > spikeHeights[i]) spikeHeights[i] = rawAmp;
        else spikeHeights[i] = Math.max(0, spikeHeights[i] - gravity);

        let angle = (i / numSpikes) * Math.PI * 2;
        let r = (currentSize / 2) + spikeHeights[i];
        let x = Math.cos(angle) * r;
        let y = Math.sin(angle) * r;
        
        // 3. Spikes with Gravity
        ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}, 0.8)`;
        ctx.lineWidth = 3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        currentFramePoints.push({x: x, y: y});
    }
    ctx.closePath();
    ctx.stroke();

    // update trail items every nth frame
    if (frameCount % frameGap === 0) {
        trailItems.push(currentFramePoints);
        if (trailItems.length > numTrails) trailItems.shift();
    }

    // for each trail item, calculate points and draw 
    trailItems.forEach((points, index) => {
        //create trail offset to scale each trail
        let offset = 1 + (index * 0.01);

        let opacity = (index + 1) / (trailItems.length + 1);
        ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}%, ${opacity * 0.5})`;
        ctx.lineWidth = 1 + (index * 0.1);

        ctx.beginPath();
        points.forEach((p, i) => {
            let x = p.x * offset;
            let y = p.y * offset;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
    });

    // initialise ellipse
    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue}, 80%, ${lightness}%, 0.6)`;
    ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

overlay.addEventListener('click', () => {
    if (!audioCtx) stream();
});