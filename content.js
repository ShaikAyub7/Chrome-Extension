document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const datePicker = document.getElementById("datePicker");
  const showDataBtn = document.getElementById("showData");
  const previous = document.getElementById("showYesterday");
  const next = document.querySelector(".arrow-right");
  const todayDate = document.getElementById("today");
  const totalTimeDisplay = document.querySelector(".totalTimeDisplay");

  // Check if the user's theme is set to dark mode
  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (isDarkMode) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  // Optionally, listen for changes in the user's theme preference
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const isDarkMode = e.matches;
      if (isDarkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    });

  function getLogoUrl(domain) {
    // Use Clearbit or a default logo if the domain logo is unavailable
    return `https://unavatar.io/${domain}`;
  }
  let count = 0;
  let chartInstance = null;
  const today = new Date().toISOString().split("T")[0];
  datePicker.value = today;

  const getYesterdayDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - count);
    return date.toDateString(); // Returns date as a string
  };
  const getTodayDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + count);
    return date.toDateString(); // Returns date as a string
  };

  const todaydate = new Date(
    new Date().setDate(new Date().getDate())
  ).toDateString();

  const yesterday = new Date(
    new Date().setDate(new Date().getDate() + todayDate - { count })
  ).toDateString();

  const tomorrow = new Date(
    new Date().setDate(new Date().getDate() - todayDate + { count })
  ).toDateString();

  const renderData = (selectedDate, dateLabel) => {
    let totalRuntime = 0;
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
        totalRuntime += runtime;

        const seconds = Math.floor(runtime / 1000) % 60;
        const minutes = Math.floor(runtime / (1000 * 60)) % 60;
        const hours = Math.floor(runtime / (1000 * 60 * 60));
        const domainLogo = getLogoUrl(domain);

        const listItem = ` 
        <div class='mainContainer'>
          <div class="tab-urls">
            <div class='logoConatiner'>
              <img src="${domainLogo}" alt="Logo" class="domain-logo"
                   onerror="this.onerror=null;this.src='/images/webimg.png';" />
              <p>${domain}</p> 
            </div>
          </div>
          <div class="time-container">
            <p class='time'> ${hours}h ${minutes}m ${seconds}s</p>
          </div>
           </div>`;

        urlList.insertAdjacentHTML("afterbegin", listItem);

        const totalSeconds = Math.floor(totalRuntime / 1000) % 60;
        const totalMinutes = Math.floor(totalRuntime / (1000 * 60)) % 60;
        const totalHours = Math.floor(totalRuntime / (1000 * 60 * 60));

        totalTimeDisplay.textContent = `Total time spent: ${totalHours} hours, ${totalMinutes} minutes, ${totalSeconds} seconds`;

        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }

      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy();
      }

      const uniqueColors = [
        "#FF6384",
        "#36A2EB",
        "#FFCE56",
        "#4BC0C0",
        "#9966FF",
        "#FF9F40",
        "#C9CBCF",
        "#8A2BE2",
        "#00FA9A",
        "#FFD700",
      ];
      const backgroundColors = chartLabels.map(
        (_, index) => uniqueColors[index % uniqueColors.length]
      );

      chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: "Time Spent (minutes)",
              data: chartData,
              backgroundColor: backgroundColors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false,
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

  showDataBtn.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      const selectedDate = new Date(datePicker.value).toDateString();
      renderData(selectedDate, selectedDate);
    }
  });

  todayDate.addEventListener("click", () => {
    renderData(todaydate, "Today");
  });
  previous.addEventListener("click", () => {
    const yesterday = getYesterdayDate();
    renderData(yesterday, yesterday);
    count--;
  });
  next.addEventListener("click", () => {
    const tomorrow = getYesterdayDate();

    renderData(tomorrow, tomorrow);

    count++;
  });
});
