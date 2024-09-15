console.log('hello');


document.addEventListener("DOMContentLoaded", () => {
  let today = new Date().toDateString(); // Get today's date
  const urlList = document.getElementById("tabUrls");

  chrome.storage.local.get([today], (data) => {
    let tabData = data[today] || {};

    // Loop through each tab and display the domain and time spent
    for (const domain in tabData) {
      const { runtime } = tabData[domain];

      const seconds = Math.floor(runtime / 1000) % 60;
      const minutes = Math.floor(runtime / (1000 * 60)) % 60;
      const hours = Math.floor(runtime / (1000 * 60 * 60));
const hello  = 'hello'
      const html = `
        <li><b>${domain}</b> - Time Spent: ${hours}h ${minutes}m ${seconds}s ${hello}</li>
      `;
      urlList.insertAdjacentHTML("afterbegin", html); // Use insertAdjacentHTML for raw HTML
    }
  });
});
