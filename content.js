document.addEventListener("DOMContentLoaded", () => {
  const urlList = document.getElementById("tabUrls");
  const selectedDateElement = document.getElementById("selectedDate");
  const calendar = document.getElementById("calendarInput");
  const todayDate = document.getElementById("today");
  const totalTimeDisplay = document.querySelector(".totalTimeDisplay");
  const totalDomains = document.querySelector(".totalDomains");
  const customLegend = document.getElementById("customLegend");
  const dailyLimitSlider = document.getElementById("dailyLimitSlider");
  const dailyLimitValue = document.getElementById("dailyLimitValue");
  const deleteBtn = document.querySelector(".delete-data");
  const limitText = document.querySelector(".limit-text ");
  let current = dayjs();
  let chartInstance = null;

  function getLogoUrl(domain) {
    console.log(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }

  chrome.storage.local.get(["dailyLimitHours"], ({ dailyLimitHours }) => {
    const limit = dailyLimitHours || 6;
    dailyLimitSlider.value = limit;
    dailyLimitValue.textContent = `${limit}h 0m`;
  });

  dailyLimitSlider.addEventListener("input", () => {
    const hours = parseInt(dailyLimitSlider.value);
    chrome.storage.local.set({ dailyLimitHours: hours });
    dailyLimitValue.textContent = `${hours}h 0m`;
    renderData(current.format("ddd MMM DD YYYY"));
  });

  calendar?.addEventListener("change", (e) => {
    current = dayjs(e.target.value);
    renderData(current.format("ddd MMM DD YYYY"));
  });

  function updateDailyLimitUI(runtimeMs, limitHours) {
    const totalLimitMs = limitHours * 60 * 60 * 1000;
    const percent = Math.min(
      ((runtimeMs / totalLimitMs) * 100).toFixed(0),
      100
    );

    const hours = Math.floor(limitHours);
    const minutes = (limitHours % 1) * 60;

    document.querySelector(".percentage-text").textContent = `${percent}%`;
    if (percent === 100) {
      limitText.classList.add("red");
      limitText.innerHTML = `
      <p>Daily limit:</p>
      <strong>${percent}%</strong> of ${hours}h ${minutes.toFixed(0)}m
    `;
    } else if (percent < 100) {
      limitText.innerHTML = `
      <p>Daily limit:</p>
      <strong>${percent}%</strong> of ${hours}h ${minutes.toFixed(0)}m
    `;
    }

    if (percent === 100) {
      document.querySelector(".alert").innerHTML = `
      you exceed your limit ${percent}%`;
    } else {
      document.querySelector(".alert").classList.add("hidden");
    }
    document
      .querySelector(".circle")
      ?.setAttribute("stroke-dasharray", `${percent}, 100`);
  }

  function renderData(selectedDate) {
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
        totalTimeDisplay.innerHTML = `<p class="total-day-heading">Today's Total:</p>0h 0m 0s`;
        urlList.innerHTML = "<li>No data available.</li>";
        totalDomains.innerHTML = `<i class="fa-regular fa-folder-open"></i> : 0`;
        return;
      }

      totalDomains.innerHTML = `<i class="fa-regular fa-folder-open"></i>  ${
        Object.keys(tabData).length
      }`;

      for (const domain in tabData) {
        totalRuntime += tabData[domain].runtime;
      }

      updateDailyLimitUI(totalRuntime, limitHours);

      for (const domain in tabData) {
        const { runtime, sessions = 1 } = tabData[domain];
        const percent = ((runtime / limitMs) * 100).toFixed(0);
        const siteHours = Math.floor(runtime / (1000 * 60 * 60));
        const siteMinutes = Math.floor((runtime / (1000 * 60)) % 60);
        const siteSeconds = Math.floor((runtime / 1000) % 60);
        const displayTime = `${siteHours ? `${siteHours}h ` : ""}${
          siteMinutes ? `${siteMinutes}m ` : ""
        }${siteSeconds}s`;
        const safePercent = Math.min(percent, 100);

        const listItem = `
        <div class="site-usage-box">
          <div style="display:flex;justify-content:center;align-items:center">
            <img src="${getLogoUrl(domain)}" alt="${domain}" class="site-logo"
            onerror="this.onerror=null;this.src='https://unavatar.io/${domain}'" /
            >
          </div>
          <div style="width:100%;display:flex;flex-direction:column;justify-content:center;">
            <div class="site-info">
              <div class="site-meta">
                <div class="site-domain"><a href="https://${domain}" target="_blank">${domain}</a></div>
              </div>
              <div class="site-duration">${displayTime}</div>
            </div>
            <div class="site-progress">
              <div class="site-bar">
                <div class="site-bar-fill" style="width: ${safePercent}%"></div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:8px; margin-left:10px;">
              <div class="site-sessions">${sessions} session(s)</div>
              <div class="site-percent">${percent}%</div>
            </div>
          </div>
        </div>`;
        urlList.insertAdjacentHTML("beforeend", listItem);
        chartLabels.push(domain);
        chartData.push(runtime / (1000 * 60));
      }

      const totalSeconds = Math.floor(totalRuntime / 1000) % 60;
      const totalMinutes = Math.floor(totalRuntime / (1000 * 60)) % 60;
      const totalHours = Math.floor(totalRuntime / (1000 * 60 * 60));

      totalTimeDisplay.innerHTML = `<p class="total-day-heading">Today's Total:</p>${totalHours}h ${totalMinutes}m ${totalSeconds}s`;

      if (totalRuntime >= limitMs) {
        chrome.runtime.sendMessage({ type: "CLOSE_TAB" });
      }

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
        (_, i) => uniqueColors[i % uniqueColors.length]
      );

      const centerTextPlugin = {
        id: "centerText",
        beforeDraw(chart) {
          const {
            width,
            chartArea: { top, bottom },
          } = chart;
          const ctx = chart.ctx;
          ctx.save();
          const totalMinutes = chart.data.datasets[0].data.reduce(
            (a, b) => a + b,
            0
          );
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.floor(totalMinutes % 60);
          ctx.font = "bold 18px sans-serif";
          ctx.fillStyle = "#333";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            `${hours}h ${minutes}min`,
            width / 2,
            (top + bottom) / 2
          );
          ctx.restore();
        },
      };

      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: chartLabels,
          datasets: [
            {
              data: chartData,
              backgroundColor: backgroundColors,
              borderWidth: 1.5,
              borderRadius: 6,
              borderColor: "#fff",
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
                label: (tooltipItem) => {
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
              <span>${label}</span>
            </div>
            &nbsp; ${percent}% • ${hours ? `${hours}h ` : ""}${
            mins ? `${mins}m` : ""
          }
          </div>`;
        }
      });
    });
  }

  renderData(current.format("ddd MMM DD YYYY"));
  setInterval(() => {
    renderData(current.format("ddd MMM DD YYYY"));
  }, 1000);

  deleteBtn.addEventListener("click", function () {
    const selected = current.format("ddd MMM DD YYYY");
    const check = confirm("Are you sure you want to delete this data?");
    if (!check) return;
    chrome.storage.local.remove(selected, () => renderData(selected));
  });
});
