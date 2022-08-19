function onDocumentReady(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

class Renderer {
  constructor() {
    this.data = null;
  }

  async initData() {
    this.data = await this.getGamemode40lData();
  }

  getGamemode40lData() {
    return new Promise((resolve) => {
      Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        transformHeader: (header) => {
          if (header === "time_ms") {
            return "time";
          }
          return header;
        },
        transform: (value, header) => {
          if (header === "played_at") {
            return Math.floor(Date.parse(value)/1000);
          } else if (header === "time") {
            return value / 1000; // Transform from milliseconds to seconds
          }
          return value;
        },
      })
    });
  }

  render40LOverTime() {
    const xAxis = [];
    const yAxis = [];
    for (const v of this.data) {
      xAxis.push(v.played_at);
      yAxis.push(v.time);
    }
    const data = [xAxis, yAxis]
    let opts = {
      title: "40L performance over time",
      id: "40l-over-time-chart",
      width: 800,
      height: 300,
      series: [
        {
          label: "Timestamp",
        },
        {
          // initial toggled state (optional)
          show: true,
          // in-legend display
          label: "Time",
          value: (self, rawValue) => rawValue + "s",

          // series style
          stroke: "red",
          width: 1,
          drawStyle: null,
        }
      ],
    };
    let uplot = new uPlot(opts, data, document.getElementById("40l-over-time-container"));
  }

  render40LOverGamesPlayed() {
    const { spline } = uPlot.paths;
    const xAxis = [];
    const yAxis = [];
    let count = 1;
    for (const v of this.data) {
      xAxis.push(count++);
      yAxis.push(v.time);
    }
    const data = [xAxis, yAxis]
    let opts = {
      title: "40L performance over games played",
      id: "40l-over-games-played-chart",
      width: 800,
      height: 300,
      scales: {
        x: {
          time: false,
        },
        y: {
          auto: true,
        }
      },
      series: [
        {
          label: "Game number",
        },
        {
          // initial toggled state (optional)
          show: true,
          // in-legend display
          label: "Time",
          value: (self, rawValue) => rawValue + "s",

          // series style
          stroke: "red",
          width: 1,
          drawStyle: null,
          paths: spline(),
        }
      ],
    };

    let uplot = new uPlot(opts, data, document.getElementById("40l-over-games-played-container"));
  }
}

async function main() {
  const renderer = new Renderer();
  await renderer.initData();
  renderer.render40LOverTime();
  renderer.render40LOverGamesPlayed();
}

onDocumentReady(main)
