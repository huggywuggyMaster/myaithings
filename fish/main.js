function playFish() {
    // Button hinzufügen
    const btn = document.createElement('button');
    btn.textContent = 'Drück mich!';
    document.body.appendChild(btn);

    // Audio vorbereiten
    const audio = new Audio('I am just a fish (alternate ver.).m4a');
    audio.loop = true;

    // Beim Klick: Audio abspielen, Button entfernen, Bild anzeigen
    btn.addEventListener('click', () => {
        audio.play();
        btn.remove();

        // Bild hinzufügen
        const img = document.createElement('img');
        img.src = 'https://media1.tenor.com/m/wCrZqAL1cWMAAAAC/spinning-fish.gif';
        img.className = 'fish';
        document.body.appendChild(img);
    });
}
window.onload = playFish;
