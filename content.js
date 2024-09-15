document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup script loaded.");

  const today = new Date().toDateString();
  const urlList = document.getElementById("tabUrls");
  console.log("urlList element:", urlList);

  chrome.storage.local.get([today], (data) => {
    console.log("Data from storage:", data);

    let tabData = data[today] || {};
    if (Object.keys(tabData).length === 0) {
      console.log("No data found for today.");
      urlList.innerHTML = "<li>No data available for today.</li>";
      return;
    }

    for (const domain in tabData) {
      const { runtime } = tabData[domain];

      const seconds = Math.floor(runtime / 1000) % 60;
      const minutes = Math.floor(runtime / (1000 * 60)) % 60;
      const hours = Math.floor(runtime / (1000 * 60 * 60));

      const listItem = `
      <div class='domain-container'>
        <li>${domain}</li> 
        <p class='time'>Time Spent: ${hours}h ${minutes}m ${seconds}s</p>
        
     </div> `;
      urlList.insertAdjacentHTML("afterbegin", listItem);
    }
  });

  const ctx = document.getElementById("myChart");

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
      datasets: [
        {
          label: "# of Votes",
          data: [12, 19, 3, 5, 2, 3],
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
});
