function chartModule(chartData) {
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
    (_, index) => uniqueColors[index % uniqueColors.length],
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

  // Add custom legend
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
}

export default chartModule;
