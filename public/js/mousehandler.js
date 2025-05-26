
const minScale = 0.01;
const maxScale = 4;
let currentScale = 1;
let allowZoom = true;
// Handle zoom
stage.on("wheel", (e) => {
    e.evt.preventDefault();
    if (!allowZoom) {
        return;
    }
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    let newScale = oldScale * (1 + direction * 0.1);

    if (newScale < minScale) {
        newScale = minScale;
    }
    if (newScale > maxScale) {
        newScale = maxScale;
    }
    currentScale = newScale;
    stage.scale({ x: newScale, y: newScale });

    const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
    updateGrid(); // ask for new data
});

let lastp = {x:0, y:0};
document.addEventListener('SocketOpened', ()=>setInterval((e) => {
    const pointer = stage.getPointerPosition();
    if (lastp.x == pointer.x && lastp.y == pointer.y) {
        return;
    }
    const cursorX = pointer.x;
    const cursorY = pointer.y;
    
    sendMessage("cursor", {
        x: (cursorX - stage.x()) / currentScale,
        y: (cursorY - stage.y()) / currentScale
    });
    lastp = {x: cursorX, y: cursorY};
}, 100));

