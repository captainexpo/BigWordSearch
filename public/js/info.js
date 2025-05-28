function updateLeaderboard(){
    const leaderboard = document.getElementById("leaderboard");
    const leaderboardList = document.getElementById("leaderboard-list");
    leaderboardList.innerHTML = ""; // Clear previous entries
    for (const user of Object.values(users)) {
        const li = document.createElement("li");
        li.textContent = `${user.username}[${user.id}] (${user.score})`;
        leaderboardList.appendChild(li);
    }
}