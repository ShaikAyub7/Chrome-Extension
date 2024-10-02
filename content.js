document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const next = document.getElementById("nextDay");
  const previous = document.getElementById("previousDay");
  const todayDate = document.getElementById("today");
  const totalTimeDisplay = document.querySelector(".totalTimeDisplay");
  const toggleButton = document.getElementById("toggleTheme");
  const prefersDarkScheme = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  // Function to apply the theme
  function applyTheme(theme) {
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(theme);
  }

  // Load the saved theme from chrome.storage or use system preference
  chrome.storage.local.get("theme", (data) => {
    const theme =
      data.theme || (prefersDarkScheme ? "dark-mode" : "light-mode");
    applyTheme(theme);
  });

  toggleButton.addEventListener("click", () => {
    const currentTheme = document.body.classList.contains("dark-mode")
      ? "dark-mode"
      : "light-mode";
    const newTheme = currentTheme === "dark-mode" ? "light-mode" : "dark-mode";
    applyTheme(newTheme);

    chrome.storage.local.set({ theme: newTheme });
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const theme = e.matches ? "dark-mode" : "light-mode";
      applyTheme(theme);
      chrome.storage.local.set({ theme });
    });

  let current = dayjs();
  let currentDate = dayjs().format("ddd MMM DD YYYY");
  let chartInstance = null;

  function getLogoUrl(domain) {
    return `https://unavatar.io/${domain}
    `;
  }

  const renderData = (selectedDate) => {
    let totalRuntime = 0;
    const chartLabels = [];
    const chartData = [];
    selectedDateElement.innerText = ` ${selectedDate}`;

    chrome.storage.local.get([selectedDate], (data) => {
      let tabData = data[selectedDate] || {};
      urlList.innerHTML = "";
      if (Object.keys(tabData).length === 0) {
        totalTimeDisplay.innerHTML = `
    <i class="fa-regular fa-clock" style="color: #dedede;"></i>&nbsp; 00:00:00
  `;
        urlList.innerHTML = "<li>No data available.</li>";
        return;
      }

      for (const domain in tabData) {
        const { runtime } = tabData[domain];
        totalRuntime += runtime;
        function formatTime(milliseconds) {
          const seconds = Math.floor(milliseconds / 1000) % 60;
          const minutes = Math.floor(milliseconds / (1000 * 60)) % 60;
          const hours = Math.floor(milliseconds / (1000 * 60 * 60));

          let timeString = "";

          if (hours > 0) {
            timeString += `${hours}h `;
          }

          if (minutes > 0 || hours > 0) {
            timeString += `${minutes}m `;
          }

          timeString += `${seconds}s`;

          return timeString;
        }
        const formattedTime = formatTime(runtime);

        const domainLogo = getLogoUrl(domain);

        const listItem = ` 
        <div class='mainContainer'>
          <div class="tab-urls">
            <div class='logoConatiner'>
              <img src="${domainLogo}" alt="Logo" class="domain-logo"
                   onerror="this.onerror=null;this.src='/images/webimg.png';" />
             <p > <a href="https://${domain}" target="_blank" >${domain}</a> </p>
            </div>
          </div>
          <div class="time-container">
            <p class='time'> ${formattedTime}</p>
          </div>
           </div>`;

        urlList.insertAdjacentHTML("afterbegin", listItem);

        totalTimeDisplay.classList.add("totalTimeDisplay");
        totalTimeDisplay.innerHTML = `
<i class="fa-regular fa-clock" style="color: #dedede;"></i>&nbsp; No Data Available
`;

        // Calculate the total runtime in hours, minutes, seconds
        const totalSeconds = Math.floor(totalRuntime / 1000) % 60;
        const totalMinutes = Math.floor(totalRuntime / (1000 * 60)) % 60;
        const totalHours = Math.floor(totalRuntime / (1000 * 60 * 60));

        // Format the total time with leading zeroes if necessary
        const formattedSeconds = totalSeconds.toString().padStart(2, "0");
        const formattedMinutes = totalMinutes.toString().padStart(2, "0");
        const formattedHours = totalHours.toString().padStart(2, "0");

        totalTimeDisplay.classList.add("totalTimeDisplay");

        totalTimeDisplay.innerHTML = `
    <i class="fa-regular fa-clock" ></i>&nbsp; ${formattedHours}:${formattedMinutes}:${formattedSeconds}
  `;

        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }
      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy();
      }

      const uniqueColors = [
        "#e63946",
        "#9e0059",
        "#640d14",
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
        "#22b8cf",
        "#6a0572",
        "#f72585",
        "#3a0ca3",
        "#f94144",
        "#43aa8b",
        "#f3722c",
        "#90be6d",
        "#577590",
        "#ff6f61",
        "#2d6a4f",
        "#9d0208",
        "#007f5f",
        "#8338ec",
        "#ffbe0b",
        "#00b4d8",
        "#9b5de5",
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
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          animation: {
            animateScale: true,
            animateRotate: true,
          },
          plugins: {
            legend: {
              display: false,
              position: "bottom",
              labels: {
                font: {
                  size: 14,
                },
                boxWidth: 1000,
              },
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
          elements: {
            arc: {
              borderRadius: 1,
            },
          },
        },
      });
    });
    const customLegend = document.getElementById("customLegend");
    customLegend.innerHTML = `
      <h3 class='graphHeading'>Graph</h3>
      <small class='graphText' >This graph shows the time you've spent on different websites everyday. Each color represents a specific domain, with larger slices indicating more time spent. Hover over a section to see the exact time spent on that site in hours and minutes.</small>
  `;
  };

  renderData(currentDate);

  todayDate.addEventListener("click", () => {
    if (todayDate === today) {
      next.style.opacity = 0.3;
      next.style.pointerEvents = "none";
    }
    renderData(currentDate);
  });
  previous.addEventListener("click", () => {
    const previousDay = dayjs(current).subtract(1, "day");
    current = previousDay;
    const formattedPreviousDay = previousDay.format("ddd MMM DD YYYY");
    if (formattedPreviousDay !== currentDate) {
      next.style.opacity = 1;
      next.style.pointerEvents = "auto";
    }
    renderData(formattedPreviousDay);
  });
  next.addEventListener("click", () => {
    const nextDay = dayjs(current).add(1, "day");
    current = nextDay;

    const formattedNextDay = nextDay.format("ddd MMM DD YYYY");
    console.log(formattedNextDay);
    if (formattedNextDay === currentDate) {
      next.style.opacity = 0.3;
      next.style.pointerEvents = "none";
    } else {
      next.style.opacity = 1;
      next.style.pointerEvents = "auto";
    }
    renderData(formattedNextDay);
  });
  if (currentDate === dayjs().format("ddd MMM DD YYYY")) {
    next.style.opacity = 0.3;
    next.style.pointerEvents = "none";
  } else {
    next.style.opacity = 1;
    next.style.pointerEvents = "auto";
  }
});
