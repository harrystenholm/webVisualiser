// get html variables
const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

const settingsToggle = document.getElementById('advanced');
const sidePanel = document.getElementById('side-panel');

const themeInput = document.getElementById('colorTheme');
const modeInput = document.getElementById('mode');

const trailCountInput = document.getElementById('trailCount');
const ellipseCountInput = document.getElementById('ellipseCount');

// Toggle the side panel visibility
settingsToggle.addEventListener('change', () => {
    if (settingsToggle.checked) {
        sidePanel.classList.remove('hidden');
    } else {
        sidePanel.classList.add('hidden');
    }
});

let audioCtx, analyser, data, hue, lightness;
let spikeHeights = new Array(60).fill(0);
let currentSize = 5;
const numSpikes = 60;
const gravity = 2.0;
let trailItems = [];
let frameCount = 0;
const frameGap = 2;

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

    // retrieves num trails, glow, mode and theme input values
    const numTrails = parseInt(trailCountInput.value);
    const theme = themeInput.value;
    const mode = modeInput.value;
    if (mode === 'waveform') {
        analyser.getByteTimeDomainData(data);
    } else if (mode === 'frequency') {
        analyser.getByteFrequencyData(data);
    }

    // Set canvas values
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Ensure it scales and stays centered with window size
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 600;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);


    //initialise volume and ellipse target size
    let bassAvg = data[0] / 255; 
    let targetSize = (bassAvg * 150);
    currentSize += (targetSize - currentSize) * 0.35; // Lerp

    // initiliase colour changing based on volume
    // (0 is red, 120 is green, 240 is blue)
    if (theme === 'ocean') {
        hue = 200 + (bassAvg * 40);
        lightness = 50;
    } else if (theme === 'fire') {
        hue = 0 + (bassAvg);
        lightness = 60;
    } else if (theme === 'forest') {
        hue = 100 + (bassAvg * 40);
        lightness = 15;
    }
    
    // initialise outline
    let currentFramePoints = [];
    ctx.beginPath();
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
        
        let style = `hsla(${hue}, 80%, ${lightness}, 0.8)`;
        ctx.shadowBlur = 15 + (i * 5); 
        ctx.shadowColor = style;

        // 3. Spikes with Gravity
        ctx.strokeStyle = style;
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
        while (trailItems.length > numTrails) {
            trailItems.shift();
        }
        if (numTrails === 0 ) trailItems = []
    }

    // for each trail item, calculate points and draw 
    trailItems.forEach((points, index) => {
        //create trail offset to scale each trail
        let offset = 1 + (index * 0.01);

        let opacity = (index + 1) / (trailItems.length + 1);
        ctx.strokeStyle = `hsla(${hue + (index * 5)}, 80%, ${lightness}%, ${opacity * 0.5})`;
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
    
    const ellipseCount = parseInt(ellipseCountInput.value);
    for (i = 0; i < ellipseCount; i++){
        // initialise ellipse
        ctx.beginPath();
        let innerHue = hue + (i * 10);
        let innerAlpha = 1 - (i * 0.05);
        let style = `hsla(${innerHue}, 100%, 70%, ${innerAlpha})`;

        ctx.shadowBlur = 15 + (i * 5); 
        ctx.shadowColor = style;

        ctx.strokeStyle = style;
        ctx.lineWidth = 1;

        let baseScale = 0.9 - (i * 0.1);
        let wobble = Math.abs(Math.sin(frameCount * 0.01 + (i * 0.1))) * 10;
        // The + Math.sin makes it "wobble" independently of the bass
        let innerSize = Math.max(0, (currentSize / 2) * baseScale - wobble);

        ctx.arc(0, 0, innerSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
    
    ctx.restore();
}

overlay.addEventListener('click', () => {
    if (!audioCtx) stream();
});