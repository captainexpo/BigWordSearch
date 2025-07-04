
const SocketOpenedEvent = new Event("SocketOpened");



(function waitForEnv() {
    if (typeof ENV !== "undefined" && ENV.WS_URL) {
        window.socket = new WebSocket(ENV.WS_URL);
        
        window.socket.onopen = () => {
            updateGrid();
            sendMessage("getID", {});
            sendMessage("getFoundWords", {});
            sendMessage("getAllUserData", {});
            document.dispatchEvent(SocketOpenedEvent);
        };



        window.socket.onmessage = (event) => {
            console.log("Message from server: ", event.data);
            let data = JSON.parse(event.data);
            const resultType = data.message;
            if (resultType == "error") {
                console.error("Error from server: ", data.data);
                window.alert("An error has occured, please reload the page.");
                return;
            }

            
            switch(data.message) {
                case "gridData":
                    if (typeof data.data[0] == "number") {
                        // If the data is a number, convert it to a string
                        data.data = data.data.map((num) => num.toString());
                    }
                    const gridData = data.data.split("\n");
                    //console.log("Grid data: ", gridData, data.offsetX, data.offsetY);
                    recievedGridData(gridData, data.offsetX, data.offsetY);
                    break;
                case "wordGuess":
                    //console.log("Word guess: ", data.data);
                    const wasGood = data.data;
                    console.log("Word guess: ", wasGood);
                    if (wasGood) {
                        console.log("Word guess was good");
                        successfullyGotWord(data.x, data.y, data.x2, data.y2);
                        // play a sound
                        const audio = new Audio("/sounds/ding.mp3");
                        audio.play().catch((err) => {
                            console.error("Failed to play sound: ", err);
                        });
                    }
                    break;
                case "cursorData":
                    const cursorData = data.data;
                    recievedCursorData(cursorData);
                    break;
                case "getID":
                    LOCAL_USER.id = data.data;
                    break;
                case "getFoundWords":
                    const foundWords = data.data;
                    console.log("Found words: ", foundWords);
                    for (const {x1, y1, x2, y2} of foundWords) {
                        successfullyGotWord(x1, y1, x2, y2);
                    }
                    break;
                case "getAllUserData":
                    const userData = data.data;
                    console.log("User data: ", userData);
                    // Remove existing users
                    users = {};
                    for (const user of userData) {
                        const u = new User();
                        u.id = user.id;
                        u.username = user.username;
                        u.score = user.score;
                        users[u.id] = u;
                    }
                    updateLeaderboard();
                    break;
                case "userJoin":
                case "userUpdate":
                    const userUpdate = data.user;
                    console.log("User update: ", userUpdate);
                    if (users[userUpdate.id]) {
                        users[userUpdate.id].username = userUpdate.username;
                        users[userUpdate.id].score = userUpdate.score;
                    } else {
                        const u = new User();
                        u.id = userUpdate.id;
                        u.username = userUpdate.username;
                        u.score = userUpdate.score;
                        users[u.id] = u;
                    }
                    updateLeaderboard();
                    break;
                case "userLeave":
                    const userLeaveId = data.user.id;
                    console.log("User left: ", userLeaveId);
                    if (users[userLeaveId]) {
                        delete users[userLeaveId];
                    }
                    updateLeaderboard();
                    break;
                default:    
                    console.error("Unknown message type: ", data.message);
            }
        };


    } else {
        setTimeout(waitForEnv, 50);
    }
})();

    
function sendMessage(message, data) {
    if (window.socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    switch(message) {
        case "gridData":
            data = [...toull(data.x), ...toull(data.y), ...toull(data.x1), ...toull(data.y1)];
            break;
        default:
            data = data;
            break;
    }
    //console.log("Sending message: ", message, data);
    try {
        window.socket.send(JSON.stringify({ message: message, data: data }));        
    }
    catch (error) {
        return false;
    }
    return true;
}




function toull(number) {
  const n = BigInt(number) & ((1n << 64n) - 1n); // Clamp to 64 bits
  const buffer = new ArrayBuffer(8); // 8 bytes for 64-bit
  const view = new DataView(buffer);
  view.setBigUint64(0, n, true); // true = little endian
  return new Uint8Array(buffer);
}


