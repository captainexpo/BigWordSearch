var ENV = {};
(async () => {
    const response = await fetch('/env');
    if (!response.ok) {
        console.error("Failed to load env.json");
        return;
    }
    const data = await response.json();
    Object.assign(ENV, data);
    //console.log("ENV loaded: ", ENV);
})();