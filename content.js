document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const datePicker = document.getElementById("datePicker");
  const showDataBtn = document.getElementById("nextDay");
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
    return `https://unavatar.io/${domain}

`;
  }
  let count = 0;
  let chartInstance = null;
  const today = new Date().toISOString().split("T")[0];
  // datePicker.value = today;

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
    selectedDateElement.innerText = ` ${dateLabel}`;

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

        totalTimeDisplay.textContent = `Total time spent: ${totalHours}h ${totalMinutes}m ${totalSeconds}s`;

        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }

      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy();
      }

      const uniqueColors = [
        "#e63946", // Red
        "#9e0059", // Deep Pink
        "#640d14", // Dark Red
        "#FF6384", // Pink
        "#36A2EB", // Blue
        "#FFCE56", // Yellow
        "#4BC0C0", // Aqua Green
        "#9966FF", // Purple
        "#FF9F40", // Orange
        "#C9CBCF", // Grey
        "#8A2BE2", // BlueViolet
        "#00FA9A", // MediumSpringGreen
        "#FFD700", // Gold
        "#22b8cf", // Cyan
        "#6a0572", // Dark Purple
        "#f72585", // Magenta
        "#3a0ca3", // Dark Blue
        "#f94144", // Vibrant Red
        "#43aa8b", // Mint Green
        "#f3722c", // Warm Orange
        "#90be6d", // Soft Green
        "#577590", // Slate Blue
        "#ff6f61", // Coral
        "#2d6a4f", // Forest Green
        "#9d0208", // Burgundy
        "#007f5f", // Jade Green
        "#8338ec", // Electric Purple
        "#ffbe0b", // Bright Yellow
        "#00b4d8", // Light Blue
        "#9b5de5", // Light Purple
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
    const customLegend = document.getElementById("customLegend");
    customLegend.innerHTML = `
      <h3 class='graphHeading'>Graph</h3>
      "<small>This graph shows the time you've spent on different websites everyday. Each color represents a specific domain, with larger slices indicating more time spent. Hover over a section to see the exact time spent on that site in hours and minutes.</small>";
  `;
  };

  const todayLabel = new Date().toDateString();
  renderData(todayLabel, "Today");

  // showDataBtn.addEventListener("click", () => {
  //   // const selectedDate = new Date(datePicker.value).toDateString();
  //   renderData(selectedDate, selectedDate);
  // });

  // showDataBtn.addEventListener("keydown", (e) => {
  //   if (e.key === " ") {
  //     // const selectedDate = new Date(datePicker.value).toDateString();
  //     renderData(selectedDate, selectedDate);
  //   }
  // });

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
