const SocketOpenedEvent = new Event("SocketOpened");



(function waitForEnv() {
    if (typeof ENV !== "undefined" && ENV.WS_URL) {
        window.socket = new WebSocket(ENV.WS_URL);
        
        window.socket.onopen = () => {
            updateGrid();
            sendMessage("getID", {});
            document.dispatchEvent(SocketOpenedEvent);
        };



        window.socket.onmessage = (event) => {
            if (!event.data) return;
            let data = JSON.parse(event.data);
            const resultType = data.message;
            if (resultType == "error") {
                console.error("Error from server: ", data.data);
                window.alert("An error has occured, please reload the page.");
                return;
            }

            if (!data.data){
                return;
            }
            if (data.message != "cursorData")console.log("Data: ", data);
            
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
                    }
                    
                    break;
                case "cursorData":
                    const cursorData = data.data;
                    recievedCursorData(cursorData);
                    break;
                case "getID":
                    LOCAL_USER.id = data.data;
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


