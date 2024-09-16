document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const datePicker = document.getElementById("datePicker");
  const showDataBtn = document.getElementById("showData");
  const previous = document.getElementById("showYesterday");

  let chartInstance = null;

  const today = new Date().toISOString().split("T")[0];
  datePicker.value = today;
  const yesterday = new Date(
    new Date().setDate(new Date().getDate() - 1)
  ).toDateString();

  const renderData = (selectedDate, dateLabel) => {
    selectedDateElement.innerText = `Data of: ${dateLabel}`;

    chrome.storage.local.get([selectedDate], (data) => {
      let tabData = data[selectedDate] || {};
      urlList.innerHTML = "";

      if (Object.keys(tabData).length === 0) {
        urlList.innerHTML = "<li>No data available.</li>";
        return;
      }

      const chartLabels = [];
      const chartData = [];
      const chartColors = [];

      for (const domain in tabData) {
        const { runtime } = tabData[domain];

        const seconds = Math.floor(runtime / 1000) % 60;
        const minutes = Math.floor(runtime / (1000 * 60)) % 60;
        const hours = Math.floor(runtime / (1000 * 60 * 60));

        const listItem = `
        <div class="tab-urls">
        <li>${domain}</li> 
        </div>
        <div class="time-container">
        <p class='time'>Time Spent: ${hours}h ${minutes}m ${seconds}s</p>
        </div>`;
        urlList.insertAdjacentHTML("afterbegin", listItem);

        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }

      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy();
      }
      chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: "Time Spent (minutes)",
              data: chartData,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "bottom",
              font: {
                size: 14,
              },
              boxWidth: 20,
            },
            tooltip: {
              callbacks: {
                label: function (tooltipItem) {
                  const minutes = tooltipItem.raw;
                  const hours = Math.floor(minutes / 60);
                  const mins = Math.floor(minutes % 60);
                  return `${tooltipItem.label}: ${hours}h ${mins}m`;
                },
              },
            },
          },
        },
      });
    });
  };

  const todayLabel = new Date().toDateString();
  renderData(todayLabel, "Today");

  showDataBtn.addEventListener("click", () => {
    const selectedDate = new Date(datePicker.value).toDateString();
    renderData(selectedDate, selectedDate);
  });
  previous.addEventListener("click", () => {
    renderData(yesterday, "Yesterday");
  });
});
