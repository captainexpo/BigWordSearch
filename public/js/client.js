class User {
    id = 0
    score = 0
    username = "anonymous"

    
    constructor() {}

    toString() {
        return `User(id=${this.id}, username=${this.username}, score=${this.score})`;
    }

}


const LOCAL_USER = new User();
var users = {};