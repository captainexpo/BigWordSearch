
const minScale = 0.01;
const maxScale = 4;
let currentScale = 1;
// Handle zoom
stage.on("wheel", (e) => {
    e.evt.preventDefault();
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