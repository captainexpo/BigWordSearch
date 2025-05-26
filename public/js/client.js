class User {
    constructor() {
        this.id = null;
        this.cursorPos = { x: 0, y: 0 };
        this.cursorColor = "#000000";
    }


    setId(id) {
        this.id = id;
    }

    setCursorPos(x, y) {
        this.cursorPos.x = x;
        this.cursorPos.y = y;
    }

    toString() {
        return `User(id=${this.id}, cursorPos=(${this.cursorPos.x}, ${this.cursorPos.y}), cursorColor=${this.cursorColor})`;
    }
}


const LOCAL_USER = new User();