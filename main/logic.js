let song, fft;
let spikeHeights = [];
const numSpikes = 60;
const gravity = 2.0;
let currentSize = 150;
let started = false;

function setup() {
    createCanvas(windowWdith, windowHeight);
    angleMode(DEGREES);

    stream = new p5.AudioIn();

    fft = new p5.FFT(0.8, 1024);
    fft.setInput(mic);

    for (let i = 0; i < numSpikes; i++) spikeHeights[i] = 0;
}

function draw() {
    background(0);

    if (!started) {
        fill(255);
        textAlign(CENTER);
        text("ENABLE MICROPHONE", width / 2, height / 2);
        return
    }

    let scaleFactor = min(width, height) / 600;
    translate(width / 2, height / 2);
    scale(scaleFactor);

    let spectrum = fft.analyse();

    let micLevel = mic.getlevel();
    let targetSize = map(micLevel, 0 , 1, 0, 300);
    currentSize = lerp(currentSize, targetSize, 0.2);

    fill(0, 0, 255, 150);
    noStroke();
    circle(0, 0, currentSize);

    stroke(0, 255, 0);
    strokeweight(3);
    noFill;

    beginShape();
    for (let i = 0; i < numSpikes; i++) {
        let index = Math.floor(map(i, 0, numSpikes, 0, spectrum.length / 4));
        let rawAmp = map(spectrum[index], 0, 255, 0, 150);

        if (rawAmp > spikeHeights[i]) {
            spikeHeights[i] = rawAmp;
        } else {
            spikeHeights[i] -= gravity;
        }
        spikeHeights[i] = max(0, spikeHeights[i]);

        let angle = map(i, 0, numSpikes, 0, 360);
        let r = (currentSize / 2) + spikeHeights[i];
        let x = r * cos(angle);
        let y = r * sin(angle);
        vertex(x, y);
    }
    endShape(CLOSE);
}

// Crucial: Browsers require a click to start audio context
function mousePressed() {
  if (!started) {
    userStartAudio(); // Resume AudioContext
    mic.start();      // Request mic permission
    started = true;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}