document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const datePicker = document.getElementById("datePicker");
  const showDataBtn = document.getElementById("nextDay");
  const next = document.getElementById("showYesterday");
  const previous = document.querySelector(".arrow-right");
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
  let current = new Date();
  let name = "saad";
  console.log({ name });
  let chartInstance = null;
  const today = new Date().toISOString().split("T")[0];
  // datePicker.value = today;

  const getCurrentDay = () => {
    const date = new Date();
    current = date.setDate(date.getDate() - count);
    date.setDate(date.getDate() - count);
    return date.toDateString(); // Returns date as a string
  };
  // const getTodayDate = () => {
  //   const date = new Date();
  //   date.setDate(date.getDate() + count);
  //   return date.toDateString(); // Returns date as a string
  // };

  // const yesterday = new Date(
  //   new Date().setDate(new Date().getDate() + todayDate - { count })
  // ).toDateString();

  // const tomorrow = new Date(
  //   new Date().setDate(new Date().getDate() - todayDate + { count })
  // ).toDateString();
  const formatDate = (date) => {
    return new Date(date).toDateString(); // Return the date as a string
  };
  const renderData = (selectedDate, dateLabel) => {
    console.log({ selectedDate });
    console.log({ dateLabel });
    let totalRuntime = 0;
    selectedDateElement.innerText = ` ${name}`;

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
              <a href="https://${domain}" target="_blank" >${domain}</a> 
            </div>
          </div>
          <div class="time-container">
            <p class='time'> ${formattedTime}</p>
          </div>
           </div>`;

        urlList.insertAdjacentHTML("afterbegin", listItem);

        const totalSeconds = Math.floor(totalRuntime / 1000) % 60;
        const totalMinutes = Math.floor(totalRuntime / (1000 * 60)) % 60;
        const totalHours = Math.floor(totalRuntime / (1000 * 60 * 60));
        totalTimeDisplay.classList.add("totalTimeDisplay");
        totalTimeDisplay.textContent = `${totalHours}h ${totalMinutes}m ${totalSeconds}s`;

        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }
      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) {
        chartInstance.destroy(); // Destroy the previous chart instance
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
              hoverOffset: 10, // Create a dynamic hover effect
              shadowOffsetX: 15, // Simulate a shadow for 3D-like effect
              shadowOffsetY: 20,
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.8)", // Light shadow color
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
              borderRadius: 5,
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

  const CurrentDate = formatDate(new Date());
  renderData(CurrentDate, CurrentDate);

  const toggleNextButtonVisibility = () => {
    const today = formatDate(new Date());
    const nextDate = getCurrentDay();
    if (nextDate === today) {
      previous.style.opacity = 0.3;
      previous.style.pointerEvents = "none";
    } else {
      previous.style.opacity = 1;
      previous.style.pointerEvents = "auto";
    }
  };
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
    renderData(CurrentDate, CurrentDate);
  });
  previous.addEventListener("click", () => {
    console.log("previous", current);
    name = "ayub";
    console.log({ name });
    current;
    const currentDay = getCurrentDay();

    // console.log("date", new Date(currentDay).getDate());
    // console.log("today", new Date());
    console.log(
      new Date(currentDay).toDateString() === new Date().toDateString()
    );
    if (new Date(currentDay).toDateString() === new Date().toDateString()) {
      return;
    }
    toggleNextButtonVisibility();
    renderData(currentDay, currentDay);
    count--;
  });
  next.addEventListener("click", () => {
    const currentDay = getCurrentDay();
    console.log("date", currentDay);

    toggleNextButtonVisibility();
    renderData(currentDay, currentDay);

    count++;
  });
});
