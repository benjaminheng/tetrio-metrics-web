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

  render40LTimeChart() {
    const { spline } = uPlot.paths;
    const xAxis = [];
    const yAxis = [];
    for (const v of this.data) {
      xAxis.push(v.played_at);
      yAxis.push(v.time);
    }
    const data = [xAxis, yAxis]
    let opts = {
      title: "40L time",
      id: "40l-time-chart",
      width: 800,
      height: 400,
      series: [
        {},
        {
          // initial toggled state (optional)
          show: true,
          // in-legend display
          label: "time",
          value: (self, rawValue) => rawValue + "s",

          // series style
          stroke: "red",
          width: 1,
          // paths: spline(),
        }
      ],
    };

    let uplot = new uPlot(opts, data, document.getElementById("40l-time-container"));
  }

}

async function main() {
  const renderer = new Renderer();
  await renderer.initData();
  renderer.render40LTimeChart();
}

onDocumentReady(main)
