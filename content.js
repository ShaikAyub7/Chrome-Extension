document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const next = document.getElementById("nextDay");
  const previous = document.getElementById("previousDay");
  const todayDate = document.getElementById("today");
  const totalTimeDisplay = document.querySelector(".totalTimeDisplay");
  const totalDomains = document.querySelector(".totalDomains");
  const customLegend = document.getElementById("customLegend");
  const dailyLimitSlider = document.getElementById("dailyLimitSlider");
  const dailyLimitValue = document.getElementById("dailyLimitValue");

  let current = dayjs();
  let currentDate = dayjs().format("ddd MMM DD YYYY");
  let chartInstance = null;

  // Load and display stored limit
  chrome.storage.local.get(["dailyLimitHours"], ({ dailyLimitHours }) => {
    const limit = dailyLimitHours || 6;
    dailyLimitSlider.value = limit;
    dailyLimitValue.textContent = `${limit}h 0m`;
  });

  dailyLimitSlider.addEventListener("input", () => {
    const hours = parseInt(dailyLimitSlider.value);
    chrome.storage.local.set({ dailyLimitHours: hours });
    dailyLimitValue.textContent = `${hours}h 0m`;
    renderData(currentDate);
  });

  function getLogoUrl(domain) {
    return `https://unavatar.io/${domain}`;
  }

  const renderData = (selectedDate) => {
    let totalRuntime = 0;
    const chartLabels = [];
    const chartData = [];
    selectedDateElement.innerText = ` ${selectedDate}`;

    chrome.storage.local.get([selectedDate, "dailyLimitHours"], (data) => {
      let tabData = data[selectedDate] || {};
      const limitHours = data.dailyLimitHours || 6;
      const limitMs = limitHours * 60 * 60 * 1000;

      urlList.innerHTML = "";
      customLegend.innerHTML = "";

      if (Object.keys(tabData).length === 0) {
        totalTimeDisplay.innerHTML = `<i class="fa-regular fa-clock"></i>&nbsp; 00:00:00`;
        urlList.innerHTML = "<li>No data available.</li>";
        totalDomains.innerHTML = `Opened Websites : 0`;
        return;
      }

      const totalDomain = Object.keys(tabData).length;
      totalDomains.innerHTML = `Opened Websites : ${totalDomain}`;

      // calculate total
      for (const domain in tabData) {
        totalRuntime += tabData[domain].runtime;
      }

      for (const domain in tabData) {
        const { runtime, sessions = 1 } = tabData[domain];
        const domainLogo = getLogoUrl(domain);

        const percent = ((runtime / totalRuntime) * 100).toFixed(0);
        const sessionCount = sessions;
        const siteHours = Math.floor(runtime / (1000 * 60 * 60));
        const siteMinutes = Math.floor((runtime / (1000 * 60)) % 60);
        const siteSeconds = Math.floor((runtime / 1000) % 60);

        const displayTime = `${siteHours ? `${siteHours}h` : ""} ${
          siteMinutes ? `${siteMinutes}m` : ""
        } ${siteSeconds}s
         `;

        const listItem = `
        <div class="site-usage-box">
          <div class="site-info">
            <img src="${domainLogo}" alt="${domain}" class="site-logo"
                 onerror="this.onerror=null;this.src='/images/webimg.png';" />
            <div class="site-meta">
              <div class="site-domain">
                <a href="https://${domain}" target="_blank">${domain}</a>
              </div>
              <div class="site-sessions">${sessionCount} session(s)</div>
            </div>
            <div class="site-duration">${displayTime}</div>
          </div>
          <div class="site-progress">
            <div class="site-bar">
              <div class="site-bar-fill" style="width: ${percent}%"></div>
            </div>
            <div class="site-percent">${percent}%</div>
          </div>
        </div>
        `;

        urlList.insertAdjacentHTML("beforeend", listItem);
        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60)); // minutes
      }

      // Show total time spent
      const totalSeconds = Math.floor(totalRuntime / 1000) % 60;
      const totalMinutes = Math.floor(totalRuntime / (1000 * 60)) % 60;
      const totalHours = Math.floor(totalRuntime / (1000 * 60 * 60));
      totalTimeDisplay.innerHTML = `<i class="fa-regular fa-clock"></i>&nbsp; ${String(
        totalHours,
      ).padStart(2, "0")}:${String(totalMinutes).padStart(2, "0")}:${String(
        totalSeconds,
      ).padStart(2, "0")}`;

      // Create donut chart
      const ctx = document.getElementById("myChart").getContext("2d");
      if (chartInstance) chartInstance.destroy();

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
      ];

      const backgroundColors = chartLabels.map(
        (_, i) => uniqueColors[i % uniqueColors.length],
      );

      const centerTextPlugin = {
        id: "centerText",
        beforeDraw(chart) {
          const { width } = chart;
          const { top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          const totalMinutes = chart.data.datasets[0].data.reduce(
            (a, b) => a + b,
            0,
          );
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.floor(totalMinutes % 60);
          const text = `${hours}h ${minutes}min`;
          ctx.font = "bold 18px sans-serif";
          ctx.fillStyle = "#333";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, width / 2, (top + bottom) / 2);
          ctx.restore();
        },
      };

      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: "Time Spent (minutes)",
              data: chartData,
              backgroundColor: backgroundColors,
              borderWidth: 1.5,
              borderRadius: 6,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          animation: false,
          cutout: "65%",
          plugins: {
            legend: { display: false },
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
        plugins: [centerTextPlugin],
      });

      // Render custom legend
      const totalChartMinutes = chartData.reduce((a, b) => a + b, 0);
      chartLabels.forEach((label, i) => {
        const minutes = chartData[i];
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const percent = ((minutes / totalChartMinutes) * 100).toFixed(0);
        const color = backgroundColors[i];
        if (percent > 10) {
          customLegend.innerHTML += `
          <div style="display:flex;flex-direction:column;justify-content:center;margin:4px 0;font-size:12px;font-weight:600">
            <div style="display:flex;align-items:center;">
              <span style="width:10px;height:10px;background:${color};border-radius:20%;margin-right:8px"></span>
              <span>${label}</span></div>
            &nbsp; ${percent}% • ${hours ? `${hours}h ` : ""}${
            mins ? `${mins}m` : ""
          }
          </div>`;
        }
      });
    });
  };
  renderData(currentDate);
  // setInterval(() => renderData(currentDate), 100);

  todayDate.addEventListener("click", () => renderData(currentDate));

  previous.addEventListener("click", () => {
    current = dayjs(current).subtract(1, "day");
    const formatted = current.format("ddd MMM DD YYYY");
    next.style.opacity = 1;
    next.style.pointerEvents = "auto";
    renderData(formatted);
  });

  next.addEventListener("click", () => {
    current = dayjs(current).add(1, "day");
    const formatted = current.format("ddd MMM DD YYYY");
    if (formatted === currentDate) {
      next.style.opacity = 0.3;
      next.style.pointerEvents = "none";
    } else {
      next.style.opacity = 1;
      next.style.pointerEvents = "auto";
    }
    renderData(formatted);
  });

  if (currentDate === dayjs().format("ddd MMM DD YYYY")) {
    next.style.opacity = 0.3;
    next.style.pointerEvents = "none";
  }
});
