import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const PerformanceChart = ({ performance }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current && performance.length > 0) {
      const ctx = chartRef.current.getContext("2d");
      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: performance.map((p) => new Date(p.date).toLocaleDateString()),
          datasets: [
            {
              label: "Score (%)",
              data: performance.map((p) => Math.round(p.score || 0)),
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: { display: true, text: "Score (%)" },
            },
            x: { title: { display: true, text: "Date" } },
          },
        },
      });
      return () => chart.destroy();
    }
  }, [performance]);

  return <canvas ref={chartRef} style={{ maxHeight: "300px" }} />;
};

export default PerformanceChart;