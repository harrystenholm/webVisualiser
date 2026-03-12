// get html variables
const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

const settingsToggle = document.getElementById('advanced');
const sidePanel = document.getElementById('side-panel');

const typeInput = document.getElementById('type');
const themeInput = document.getElementById('theme');
const modeInput = document.getElementById('mode');
const densityInput = document.getElementById('lineDensity');

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
document.addEventListener('click', (event) => {
    const sidebar = document.querySelector('#side-panel');
    const checkbox = document.querySelector('#advanced');
    
    // Check if the sidebar exists and if the click was OUTSIDE of it
    if (sidebar && !sidebar.contains(event.target) && event.target !== checkbox) {
        checkbox.checked = false;
        sidebar.classList.add('hidden'); 
        // Or call your specific collapse function: closeSidebar();
    }
});

let audioCtx, analyser, data, hue, lightness;
let spikeHeights = new Array(60).fill(0);
let currentSize = 5;
const gravity = 2.0;
let trailItems = [];
let waveformTrailItems = [];
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

    const type = typeInput.value;

    // retrieves num trails, spikes, glow, mode and theme input values
    const numTrails = parseInt(trailCountInput.value);
    const theme = themeInput.value;
    const mode = modeInput.value;
    const numSpikes = densityInput.value;
    if (mode === 'waveform') {
        analyser.getByteTimeDomainData(data);
    } else if (mode === 'frequency') {
        analyser.getByteFrequencyData(data);
    }

    // Set canvas values
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Ensure it scales and stays centered with window size
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 600;
    ctx.translate(centerX, centerY);
    ctx.scale((type === 'default') ? scale : 1, scale);
    
    let bassAvg = data[0] / 255 || 0; 
    // initiliase colour theme based on volume
    // (0 is red, 120 is green, 240 is blue)
    if (theme === 'ocean') {
        hue = 200 + (bassAvg * 40);
        lightness = 50;
    } else if (theme === 'fire') {
        hue = 1 + (bassAvg);
        lightness = 60;
    } else if (theme === 'forest') {
        hue = 100 + (bassAvg * 40);
        lightness = 15;
    }

    if (type === 'default') drawDefault(bassAvg, hue, lightness, numSpikes, numTrails, mode, data);
    else if (type === 'waveform') drawWaveform(hue, lightness, numSpikes, numTrails, mode, data);
    
    ctx.restore();
}

function drawDefault(bassAvg, hue, lightness, numSpikes, numTrails, mode, data) {
    if (!data) return;
    //initialise volume and ellipse target size
    let targetSize = (bassAvg * 200);
    currentSize += 10 + (targetSize - currentSize) * 0.45; // Lerp

    // dynamically update spikeHeights array length based on spike density
    while (spikeHeights.length < numSpikes) {
    spikeHeights.push(0); // Add new spikes at the end
    }
    while (spikeHeights.length > numSpikes) {
        spikeHeights.pop(); // Remove extra spikes from the end
    }

    // initialise outline
    let currentFramePoints = [];
    ctx.beginPath();    
    for (let i = 0; i < numSpikes; i++) {
        let rawAmp = 0;
        let waveId = Math.floor(i * (data.length / numSpikes));
        if (mode === 'waveform') {
            let amplitude = Math.abs(data[waveId] - 128) / 128;
            rawAmp = (amplitude * currentSize * bassAvg) * 0.9;
        } else if (mode === 'frequency') {
            rawAmp = (data[i * 2] / 255) * currentSize * bassAvg * 0.9;
        }
        // Gravity logic
        if (rawAmp > spikeHeights[i]) spikeHeights[i] = rawAmp;
        else spikeHeights[i] = Math.max(0, spikeHeights[i] - gravity);

        let angle = (i / numSpikes) * Math.PI * 2;
        let r = (currentSize / 2) + spikeHeights[i];
        let x = Math.cos(angle) * r;
        let y = Math.sin(angle) * r;
        
        let style = `hsla(${hue}, 80%, ${lightness}%, 0.8)`;
        
        ctx.strokeStyle = style;
        ctx.lineWidth = 3;

        // connect the lines
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
        let progress = ((index + 1) / trailItems.length);
        let offset = 1 + ((bassAvg * (progress)));

        let opacity = (trailItems.length) / (index + 1);
        ctx.strokeStyle = `hsla(${hue + (index * 5)}, 80%, ${lightness}%, ${opacity * 0.5})`;
        ctx.lineWidth = 1 - (index * 0.01);

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
    for (let i = 1; i < ellipseCount + 1; i++){
        // initialise ellipse
        ctx.beginPath();
        let innerHue = hue + (i * 10);
        let innerAlpha = 1 - ((i / ellipseCount) * 0.5);
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
}

function drawWaveform(hue, lightness, numSpikes, numTrails, mode, data) {
    if (!data) return;    

    const w = (canvas.width / 2) - 10;
    const h = canvas.height / 2;
    
    let currentAmp = [];
    let directions = [1, -1];
    
    for (let i = 0; i < numSpikes; i++) {
        let rawAmp = 0;
        if (mode === 'waveform') {
            let waveId = Math.floor(i * (data.length / numSpikes));
            rawAmp = (data[waveId] - 128) * 0.5;
        } else if (mode === 'frequency') {
            rawAmp = (data[i * 2] / 255) * 150;
        }
        let x = Math.round(-w + ((w * 2) * ((i + 1) / numSpikes)));
        let y = rawAmp;
        console.log(x, y);
        currentAmp.push({x: x, y: y});
    }   

    for (const dir of directions) {
        if (mode === 'waveform' && dir === -1) {
            break;
        }
        ctx.beginPath();
        let opacity = 1;
        ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness}%, ${opacity})`;
        ctx.lineWidth = 1;  
        currentAmp.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y * dir);
            else ctx.lineTo(p.x, p.y * dir);
        });
        ctx.stroke();
    }

    if (frameCount % frameGap === 0) {
        waveformTrailItems.push([...currentAmp]);
        while (waveformTrailItems.length > numTrails) waveformTrailItems.shift();
    }

    waveformTrailItems.forEach((points, index) => {
        //create trail offset to scale each trail 
        let progress = ((index + 1) / (waveformTrailItems.length || 1) );
        let step = 300 / (waveformTrailItems.length || 1);
        let offset =  (waveformTrailItems.length - index) * step;

        let opacity = 1 * progress;
        ctx.strokeStyle = `hsla(${hue + (15 * progress)}, 80%, ${lightness}%, ${opacity})`;
        ctx.lineWidth = 1 * progress;
        directions.forEach(dir => {
            ctx.beginPath();
            points.forEach((p, i) => {
                let y;
                if (mode === 'waveform') {
                    y = (p.y + offset) * dir;
                } else if (mode === 'frequency') {
                    y = (p.y * (1 - progress) * dir);
                } 
                if (i === 0) ctx.moveTo(p.x, y);
                else ctx.lineTo(p.x, y);
            });
            ctx.stroke();
        });
    }); 
}

overlay.addEventListener('click', () => {
    if (!audioCtx) stream();
});
