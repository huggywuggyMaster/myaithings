const eyesContainer = document.getElementById('background-eyes');
const numEyes = 80; // Anzahl der Augen
const eyes = [];

const eyeRadius = 30; // Halber Wert von .eye width/height in CSS
const pupilRadius = 12.5; // Halber Wert von .pupil width/height in CSS
const maxOffset = eyeRadius - pupilRadius - 2; // Maximaler Abstand der Pupille vom Zentrum

function createEye(x, y) {
    const eye = document.createElement('div');
    eye.className = 'eye';
    eye.style.left = `${x - eyeRadius}px`;
    eye.style.top = `${y - eyeRadius}px`;

    const pupil = document.createElement('div');
    pupil.className = 'pupil';
    eye.appendChild(pupil);

    eyesContainer.appendChild(eye);
    return { element: eye, pupil: pupil, x: x, y: y };
}

// Augen zufällig platzieren
for (let i = 0; i < numEyes; i++) {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    eyes.push(createEye(x, y));
}

function updateEyes(event) {
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    eyes.forEach(eye => {
        const dx = mouseX - eye.x;
        const dy = mouseY - eye.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Normalisierter Richtungsvektor
        const normX = dist === 0 ? 0 : dx / dist;
        const normY = dist === 0 ? 0 : dy / dist;

        // Pupillenversatz berechnen
        const offsetX = normX * maxOffset;
        const offsetY = normY * maxOffset;

        // Pupille transformieren
        eye.pupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
}

window.addEventListener('mousemove', updateEyes);

// Optional: Augen neu positionieren bei Fenstergrößenänderung
// (vereinfacht, könnte verbessert werden, um Augen nicht neu zu erstellen)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
         // Einfache Lösung: Seite neu laden, um Augen neu zu verteilen
         // Eine bessere Lösung würde die Augenpositionen neu berechnen.
         // window.location.reload();

         // Bessere Lösung: Augen neu positionieren (ohne Neuladen)
         eyes.forEach(eye => {
            const newX = Math.random() * window.innerWidth;
            const newY = Math.random() * window.innerHeight;
            eye.x = newX;
            eye.y = newY;
            eye.element.style.left = `${newX - eyeRadius}px`;
            eye.element.style.top = `${newY - eyeRadius}px`;
         });
         // Trigger initial update for new positions if mouse hasn't moved
         // Simulate a mouse move event at the last known position or center
         const simulatedEvent = new MouseEvent('mousemove', {
            clientX: window.innerWidth / 2, // Use center as fallback
            clientY: window.innerHeight / 2
         });
         updateEyes(simulatedEvent);

    }, 250); // Debounce resize event
});

// Initial call to position pupils correctly if needed (e.g., towards center)
const initialEvent = new MouseEvent('mousemove', {
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2
});
updateEyes(initialEvent);

