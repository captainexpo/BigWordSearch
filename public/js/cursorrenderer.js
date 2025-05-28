const cursorTargets = {};
const cursors = {};

const CURSOR_SIZE = 60;

function recievedCursorData(data) {
    // Data is a list of {x: float, y: float, id: string}
    let seenIds = [];
    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const x = d.x;
        const y = d.y;
        const id = d.id;
        seenIds.push(id);
        // console.log(LOCAL_USER.id, id, x, y);
        if (id == LOCAL_USER.id) continue;

        if (cursors[id] == null) {
            const imageObj = new window.Image();
            imageObj.src = "/images/cursor.svg";
            const cursor = new Konva.Image({
                x: x,
                y: y,
                image: imageObj,
                width: CURSOR_SIZE,
                height: CURSOR_SIZE,
                offset: { x: 0, y: 0 }
            });
            imageObj.onload = function() {
                cursorLayer.batchDraw();
            };
            cursorLayer.add(cursor);
            cursors[id] = cursor;
        }
        cursorTargets[id] = { x, y };
    }
    Object.keys(cursors).forEach((id) => {
        if (!seenIds.includes(Number(id))) {
            cursors[id].destroy();
            delete cursors[id];
            delete cursorTargets[id];
        }
    });
}

// Smoothly animate cursor positions
function animateCursors() {
    let needsDraw = false;
    for (const id in cursorTargets) {
        if (cursors[id]) {
            const target = cursorTargets[id];
            const cx = cursors[id].x();
            const cy = cursors[id].y();
            const nx = cx + (target.x - cx) * 0.1;
            const ny = cy + (target.y - cy) * 0.1;
            if (Math.abs(nx - cx) > 0.1 || Math.abs(ny - cy) > 0.1) {
                cursors[id].x(nx);
                cursors[id].y(ny);
                needsDraw = true;
            }
        }
    }
    if (needsDraw) {
        cursorLayer.batchDraw();
    }
    requestAnimationFrame(animateCursors);
}
document.addEventListener('SocketOpened', ()=>animateCursors());